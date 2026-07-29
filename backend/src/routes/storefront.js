'use strict';
const express = require('express');
const prisma = require('../lib/prisma');
const { MODELO_CATEGORIAS } = require('../lib/fixyouModelos');
const { generatePersonalizedImage, blankImage } = require('../lib/personalizedImage');
const { personalizedImageLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── CORS aberto: chamado do domínio do lojista (vitrine Nuvemshop) — mesmo
// padrão do AlugueMais/SuperCampos. Cross-Origin-Resource-Policy é sobrescrito
// explicitamente pra "cross-origin": o helmet() global (server.js) aplica o
// default "same-origin" a TODA resposta antes de chegar aqui, o que bloquearia
// o fetch()/<img> feito por um domínio de loja diferente do nosso, mesmo com
// Access-Control-Allow-Origin liberado (CORP é checado independente de CORS).
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
router.options('*', (_req, res) => res.sendStatus(204));

// ─── Cache em memória para lookup de loja (evita hit no DB a cada request) ───
const _storeCache = new Map();
const STORE_CACHE_TTL = 120000; // 2 minutos

async function findStore(nuvemshopId) {
  const hit = _storeCache.get(nuvemshopId);
  if (hit && Date.now() - hit.ts < STORE_CACHE_TTL) return hit.store;
  const store = await prisma.store.findUnique({
    where: { nuvemshopId: String(nuvemshopId) },
    select: { id: true },
  });
  _storeCache.set(nuvemshopId, { store, ts: Date.now() });
  return store;
}

// ─── GET /storefront/:storeId/products/:productId/config ────────────────────
// Config do widget de personalização pra esse produto: modelo definido, e os
// itens ATIVOS (dentre os selecionados na tela PersonalizacoesProduto do
// admin) de cada categoria permitida pelo modelo. Se alguma categoria
// obrigatória do modelo ficar sem nenhum item ativo, não há combinação válida
// possível — enabled:false (mesmo efeito do C# legado, que simplesmente não
// tinha o que renderizar no select correspondente).
router.get('/:storeId/products/:productId/config', async (req, res) => {
  try {
    const store = await findStore(req.params.storeId);
    if (!store) return res.json({ enabled: false });

    const pp = await prisma.productPersonalization.findUnique({
      where: { storeId_productId: { storeId: store.id, productId: String(req.params.productId) } },
    });
    if (!pp) return res.json({ enabled: false });

    const categorias = MODELO_CATEGORIAS[pp.modelo] || [];
    const selected = await prisma.productPersonalizationItem.findMany({
      where: { storeId: store.id, productId: String(req.params.productId) },
      include: { personalizationItem: true },
    });

    const campos = {};
    for (const cat of categorias) campos[cat] = [];
    for (const s of selected) {
      const item = s.personalizationItem;
      if (!item.ativo || !categorias.includes(item.categoria)) continue;
      campos[item.categoria].push({ id: item.id, titulo: item.titulo, posicao: item.posicao });
    }
    for (const cat of categorias) campos[cat].sort((a, b) => a.posicao - b.posicao);

    if (categorias.some((cat) => campos[cat].length === 0)) return res.json({ enabled: false });

    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ enabled: true, modelo: pp.modelo, campos });
  } catch (err) {
    console.error('[storefront] config:', err.message);
    res.json({ enabled: false });
  }
});

// ─── GET /storefront/:storeId/products/:productId/personalized-image ────────
// Gera (ou reaproveita do cache em memória) a imagem composta com base nos
// itens escolhidos pelo cliente. Sempre responde image/jpeg — nunca um erro
// JSON — porque é consumida diretamente como <img src>.
const _imageCache = new Map();
const IMAGE_CACHE_MAX = 300;

function cacheKey(storeId, productId, modelo, texto, ids) {
  return [
    storeId, productId, modelo, texto,
    ids.fonte, ids.corDeFonte, ids.icone, ids.fundo, ids.conjuntoDeCores, ids.pattern,
  ].join('|');
}

router.get('/:storeId/products/:productId/personalized-image', personalizedImageLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'image/jpeg');
  try {
    const store = await findStore(req.params.storeId);
    if (!store) return res.send(blankImage());

    const pp = await prisma.productPersonalization.findUnique({
      where: { storeId_productId: { storeId: store.id, productId: String(req.params.productId) } },
    });
    if (!pp) return res.send(blankImage());

    const ids = {
      fonte: req.query.fonte,
      corDeFonte: req.query.corDeFonte,
      icone: req.query.icone,
      fundo: req.query.fundo,
      conjuntoDeCores: req.query.conjuntoDeCores,
      pattern: req.query.pattern,
    };
    const texto = req.query.texto || '';
    const key = cacheKey(store.id, req.params.productId, pp.modelo, texto, ids);

    let buffer = _imageCache.get(key);
    if (!buffer) {
      buffer = await generatePersonalizedImage({
        storeId: store.id,
        productId: req.params.productId,
        modelo: pp.modelo,
        texto,
        ids,
      });
      if (_imageCache.size >= IMAGE_CACHE_MAX) {
        _imageCache.delete(_imageCache.keys().next().value);
      }
      _imageCache.set(key, buffer);
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  } catch (err) {
    console.error('[storefront] personalized-image:', err.message);
    res.send(blankImage());
  }
});

module.exports = router;
