const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/errors');
const { requireAuth } = require('../middleware/auth');
const { parsePagination, paginatedResponse } = require('../lib/paginate');
const { uploadToR2, getPublicUrl } = require('../lib/r2');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const CONJUNTO_DE_CORES_SIZE = 4;

// Categorias cujo valor é uma imagem enviada (URL pública do R2), em vez de
// uma cor. Cada uma pode ter seu próprio formato exigido.
const IMAGE_CATEGORIAS = {
  icones: { mimetypes: ['image/png'] },
  imagensDeFundo: { mimetypes: ['image/png', 'image/jpeg'] },
  patterns: { mimetypes: ['image/png', 'image/jpeg'] },
};

// Título e Valor são imutáveis após a criação (mesma regra do legado, aplicada
// no update abaixo) — só a validação de criação precisa conhecer o formato.
function validateValor(categoria, valor) {
  if (categoria === 'coresDeFonte') {
    if (typeof valor !== 'string' || !HEX_COLOR_RE.test(valor)) {
      throw new AppError('valor deve ser uma cor hexadecimal válida (#rrggbb).', 400, 'INVALID_VALOR');
    }
    return valor;
  }
  if (categoria === 'conjuntosDeCores') {
    if (
      !Array.isArray(valor) ||
      valor.length !== CONJUNTO_DE_CORES_SIZE ||
      !valor.every((v) => typeof v === 'string' && HEX_COLOR_RE.test(v))
    ) {
      throw new AppError(
        `valor deve ser um array com ${CONJUNTO_DE_CORES_SIZE} cores hexadecimais válidas.`,
        400,
        'INVALID_VALOR'
      );
    }
    return valor;
  }
  throw new AppError('categoria não suportada.', 400, 'INVALID_CATEGORIA');
}

async function findOwnedItem(storeId, id) {
  const item = await prisma.personalizationItem.findFirst({ where: { id: Number(id), storeId } });
  if (!item) throw new AppError('Item de personalização não encontrado.', 404, 'ITEM_NOT_FOUND');
  return item;
}

// ─── GET /api/personalizations?categoria=coresDeFonte ── lista paginada ──────
router.get('/', async (req, res, next) => {
  try {
    const { categoria } = req.query;
    if (!categoria) throw new AppError('categoria é obrigatória.', 400, 'MISSING_CATEGORIA');

    const { page, limit, skip } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();

    const where = {
      storeId: req.store.id,
      categoria: String(categoria),
      ...(search && { titulo: { contains: search, mode: 'insensitive' } }),
    };

    const [items, total] = await Promise.all([
      prisma.personalizationItem.findMany({ where, orderBy: { posicao: 'asc' }, skip, take: limit }),
      prisma.personalizationItem.count({ where }),
    ]);

    res.json(paginatedResponse(items, total, { page, limit }));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/personalizations ── cria um item ──────────────────────────────
// Categorias de imagem chegam como multipart/form-data (campo "imagem"); as
// demais continuam JSON puro — o multer não interfere quando o Content-Type
// não é multipart, então as duas formas convivem na mesma rota.
router.post('/', upload.single('imagem'), async (req, res, next) => {
  try {
    const { categoria, titulo, posicao } = req.body;

    if (!titulo || !String(titulo).trim()) {
      throw new AppError('titulo é obrigatório.', 400, 'MISSING_TITULO');
    }

    let valorValidado;
    const imageConfig = IMAGE_CATEGORIAS[categoria];
    if (imageConfig) {
      if (!req.file) throw new AppError('imagem é obrigatória.', 400, 'MISSING_IMAGEM');
      if (!imageConfig.mimetypes.includes(req.file.mimetype)) {
        throw new AppError(`A imagem deve estar em um destes formatos: ${imageConfig.mimetypes.join(', ')}.`, 400, 'INVALID_IMAGE_FORMAT');
      }
      const key = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, req.store.id, req.store.nuvemshopId);
      valorValidado = getPublicUrl(key);
      if (!valorValidado) throw new AppError('Falha ao gerar a URL pública da imagem.', 500, 'R2_PUBLIC_URL_MISSING');
    } else {
      valorValidado = validateValor(categoria, req.body.valor);
    }

    const item = await prisma.personalizationItem.create({
      data: {
        storeId: req.store.id,
        categoria: String(categoria),
        titulo: String(titulo).trim(),
        valor: valorValidado,
        posicao: Number.isFinite(Number(posicao)) ? Number(posicao) : 0,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/personalizations/:id ── atualiza SÓ ativo/posicao ─────────────
// Título e Valor nunca são aceitos aqui, mesmo se enviados no body — mesma
// regra do legado (imutáveis após a criação).
router.put('/:id', async (req, res, next) => {
  try {
    await findOwnedItem(req.store.id, req.params.id);

    const { ativo, posicao } = req.body;
    const data = {};
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (posicao !== undefined) {
      if (!Number.isFinite(Number(posicao))) throw new AppError('posicao inválida.', 400, 'INVALID_POSICAO');
      data.posicao = Number(posicao);
    }

    const updated = await prisma.personalizationItem.update({
      where: { id: Number(req.params.id) },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/personalizations/:id ── remove (hard delete) ──────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await findOwnedItem(req.store.id, req.params.id);
    await prisma.personalizationItem.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
