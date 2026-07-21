const express = require('express');
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/errors');
const { requireAuth } = require('../middleware/auth');
const { createNuvemshopClient } = require('../config/nuvemshop');
const { MODELO_IDS } = require('../lib/fixyouModelos');

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
      await prisma.productPersonalization.deleteMany({
        where: { storeId: req.store.id, productId: String(productId) },
      });
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

module.exports = router;
