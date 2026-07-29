const express = require('express');
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/errors');
const { requireAuth } = require('../middleware/auth');
const { createNuvemshopClient } = require('../config/nuvemshop');
const { MODELO_IDS, MODELO_CATEGORIAS } = require('../lib/fixyouModelos');
const { getPublicUrl } = require('../lib/r2');

const router = express.Router();
router.use(requireAuth);

const PRODUCTS_MAX_PAGE_SIZE = 100;
const PRODUCTS_DEFAULT_PAGE_SIZE = 20;

// ─── Extrai o nome exibível de um produto Nuvemshop (mapa de locales) ────────
function extractName(nsProduct) {
  if (!nsProduct || !nsProduct.name) return String(nsProduct?.id ?? '');
  const { name } = nsProduct;
  return name.pt || name.es || Object.values(name)[0] || String(nsProduct.id);
}

// ─── GET /api/products ── lista produtos da loja ─────────────────────────────
// Pagina e busca direto na API da Nuvemshop (per_page/page/q) em vez de
// espelhar o catálogo inteiro localmente — evita N+1 e escala para catálogos
// grandes. O único acesso ao banco é uma única query batched (WHERE IN) para
// anexar o modelo de personalização de cada produto da página atual.
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(
      PRODUCTS_MAX_PAGE_SIZE,
      Math.max(1, parseInt(req.query.pageSize, 10) || PRODUCTS_DEFAULT_PAGE_SIZE)
    );
    const search = String(req.query.search || '').trim();

    const client = createNuvemshopClient(req.store.nuvemshopId, req.store.accessToken);
    const { data: nsProducts, headers } = await client.get('/products', {
      params: {
        page,
        per_page: pageSize,
        fields: 'id,name',
        ...(search && { q: search }),
      },
      timeout: 10000,
    });

    const total = parseInt(headers['x-total-count'], 10) || nsProducts.length;
    const productIds = nsProducts.map((p) => String(p.id));

    const personalizacoes = productIds.length
      ? await prisma.productPersonalization.findMany({
          where: { storeId: req.store.id, productId: { in: productIds } },
        })
      : [];
    const modeloMap = new Map(personalizacoes.map((p) => [p.productId, p.modelo]));

    const products = nsProducts.map((p) => ({
      id: String(p.id),
      name: extractName(p),
      modelo: modeloMap.get(String(p.id)) ?? null,
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      products,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/products/:productId/modelo ── define ou remove o modelo ────────
// modelo ausente/null → apaga o registro (idempotente: deleteMany não falha
// se não existir). Caso contrário, upsert atômico pela chave [storeId, productId].
router.put('/:productId/modelo', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { modelo } = req.body;

    if (modelo !== null && modelo !== undefined && !MODELO_IDS.includes(Number(modelo))) {
      throw new AppError('modelo inválido.', 400, 'INVALID_MODELO');
    }

    if (modelo === null || modelo === undefined) {
      // Sem modelo, a tela de Personalizar fica inacessível — as seleções
      // feitas até então perdem sentido, então limpamos junto.
      await prisma.$transaction([
        prisma.productPersonalization.deleteMany({
          where: { storeId: req.store.id, productId: String(productId) },
        }),
        prisma.productPersonalizationItem.deleteMany({
          where: { storeId: req.store.id, productId: String(productId) },
        }),
      ]);
      return res.json({ productId: String(productId), modelo: null });
    }

    const saved = await prisma.productPersonalization.upsert({
      where: { storeId_productId: { storeId: req.store.id, productId: String(productId) } },
      update: { modelo: Number(modelo) },
      create: { storeId: req.store.id, productId: String(productId), modelo: Number(modelo) },
    });

    res.json({ productId: saved.productId, modelo: saved.modelo });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/products/:productId/personalizations ── itens disponíveis ────
// Retorna, para o modelo já definido do produto, as categorias permitidas e
// os itens ativos de cada uma (mesmo enriquecimento de fonte usado em
// personalizations.js), marcando quais já estão selecionados pra esse produto.
router.get('/:productId/personalizations', async (req, res, next) => {
  try {
    const { productId } = req.params;

    const productPersonalization = await prisma.productPersonalization.findUnique({
      where: { storeId_productId: { storeId: req.store.id, productId: String(productId) } },
    });
    if (!productPersonalization) {
      throw new AppError('Este produto ainda não tem um modelo definido.', 400, 'MODELO_NOT_SET');
    }

    const categorias = MODELO_CATEGORIAS[productPersonalization.modelo] || [];
    const client = createNuvemshopClient(req.store.nuvemshopId, req.store.accessToken);

    const [items, selected, nsProduct] = await Promise.all([
      categorias.length
        ? prisma.personalizationItem.findMany({
            where: { storeId: req.store.id, categoria: { in: categorias }, ativo: true },
            orderBy: [{ categoria: 'asc' }, { posicao: 'asc' }],
          })
        : [],
      prisma.productPersonalizationItem.findMany({
        where: { storeId: req.store.id, productId: String(productId) },
        select: { personalizationItemId: true },
      }),
      client.get(`/products/${productId}`, { params: { fields: 'id,name' }, timeout: 10000 }).then((r) => r.data),
    ]);

    const fonteIds = items
      .filter((i) => i.categoria === 'fontes')
      .map((i) => i.valor?.fontCatalogItemId)
      .filter((id) => Number.isFinite(id));
    const catalogItems = fonteIds.length
      ? await prisma.fontCatalogItem.findMany({ where: { id: { in: fonteIds } } })
      : [];
    const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));
    const selectedIds = new Set(selected.map((s) => s.personalizationItemId));

    const enrichedItems = items.map((i) => {
      const catalogItem = i.categoria === 'fontes' ? catalogMap.get(i.valor?.fontCatalogItemId) : null;
      return {
        ...i,
        fontFamily: catalogItem?.family ?? null,
        fontWebfontUrl: catalogItem ? getPublicUrl(catalogItem.webfontKey) : null,
        selecionado: selectedIds.has(i.id),
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      modelo: productPersonalization.modelo,
      productName: extractName(nsProduct),
      categorias,
      items: enrichedItems,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/products/:productId/personalizations ── salva a seleção ──────
// Substitui a seleção inteira do produto (mesma semântica do legado:
// apaga tudo e recria). Cada id enviado precisa pertencer à loja E a uma
// categoria permitida pelo modelo atual do produto — lista TODOS os ids
// inválidos numa única mensagem em vez de parar no primeiro.
router.put('/:productId/personalizations', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { personalizationItemIds } = req.body;

    if (!Array.isArray(personalizationItemIds)) {
      throw new AppError('personalizationItemIds deve ser um array.', 400, 'INVALID_BODY');
    }

    const productPersonalization = await prisma.productPersonalization.findUnique({
      where: { storeId_productId: { storeId: req.store.id, productId: String(productId) } },
    });
    if (!productPersonalization) {
      throw new AppError('Este produto ainda não tem um modelo definido.', 400, 'MODELO_NOT_SET');
    }

    const categorias = MODELO_CATEGORIAS[productPersonalization.modelo] || [];
    const ids = [...new Set(personalizationItemIds.map(Number))];
    if (ids.some((id) => !Number.isFinite(id))) {
      throw new AppError('personalizationItemIds contém um id inválido.', 400, 'INVALID_ITEM_ID');
    }

    const owned = ids.length
      ? await prisma.personalizationItem.findMany({
          where: { id: { in: ids }, storeId: req.store.id, categoria: { in: categorias } },
          select: { id: true },
        })
      : [];

    if (owned.length !== ids.length) {
      const ownedIds = new Set(owned.map((o) => o.id));
      const invalidIds = ids.filter((id) => !ownedIds.has(id));
      throw new AppError(
        `Os itens ${invalidIds.join(', ')} não pertencem a esta loja ou não são compatíveis com o modelo deste produto.`,
        400,
        'INVALID_ITEM_ID'
      );
    }

    await prisma.$transaction([
      prisma.productPersonalizationItem.deleteMany({
        where: { storeId: req.store.id, productId: String(productId) },
      }),
      ...(ids.length
        ? [
            prisma.productPersonalizationItem.createMany({
              data: ids.map((personalizationItemId) => ({
                storeId: req.store.id,
                productId: String(productId),
                personalizationItemId,
              })),
            }),
          ]
        : []),
    ]);

    res.json({ productId: String(productId), personalizationItemIds: ids });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
