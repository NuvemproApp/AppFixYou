'use strict';
const express = require('express');
const path = require('path');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── Tudo aqui é consumido pelo storefront via NubeSDK (script do worker + iframe
// cross-origin). O helmet() global aplica X-Frame-Options/CORP restritivos a TODA
// resposta, o que bloquearia o framing pela loja e o load cross-origin — então
// liberamos explicitamente framing + CORP + CORS nestas rotas.
router.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
router.options('*', (_req, res) => res.sendStatus(204));

const PUBLIC = path.join(__dirname, '..', '..', 'public');

// ─── Script do app NubeSDK (worker). Registre esta URL no Portal de Parceiros:
// https://api.fixyou.nuvempro.com/widget/app.js
router.get('/app.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(PUBLIC, 'nubesdk.min.js'));
});

// ─── Página do widget (conteúdo do iframe) — contexto vem do próprio path/query.
router.get('/:storeId/products/:productId/page', (_req, res) => {
  res.type('html');
  res.sendFile(path.join(PUBLIC, 'widget.html'));
});

// ─── Cache nuvemshopId → id interno (evita hit no DB a cada captura) ──────────
const _storeCache = new Map();
const STORE_TTL = 120000;
async function findStore(nuvemshopId) {
  const hit = _storeCache.get(nuvemshopId);
  if (hit && Date.now() - hit.ts < STORE_TTL) return hit.store;
  const store = await prisma.store.findUnique({
    where: { nuvemshopId: String(nuvemshopId) },
    select: { id: true },
  });
  _storeCache.set(nuvemshopId, { store, ts: Date.now() });
  return store;
}

const MAX_TEXT = 200;
const MAX_VAL = 200;
const MAX_KEY = 80;
const MAX_PROPS = 20;

// ─── Captura da personalização (pending) — casada com o pedido no webhook
// order/created. Best-effort: nunca derruba o fluxo da loja.
router.post('/:storeId/products/:productId/personalization', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const store = await findStore(req.params.storeId);
    if (!store) return res.json({ ok: false });

    const body = req.body || {};
    const texto = String(body.texto == null ? '' : body.texto).trim().slice(0, MAX_TEXT);

    const props = {};
    if (body.props && typeof body.props === 'object' && !Array.isArray(body.props)) {
      const keys = Object.keys(body.props).slice(0, MAX_PROPS);
      for (const k of keys) {
        const val = String(body.props[k] == null ? '' : body.props[k]).trim().slice(0, MAX_VAL);
        if (val) props[String(k).slice(0, MAX_KEY)] = val;
      }
    }

    if (!texto && !Object.keys(props).length) return res.json({ ok: false });

    const customerId = body.customerId ? String(body.customerId).slice(0, 40) : null;

    const rec = await prisma.personalizationCapture.create({
      data: {
        storeId: store.id,
        productId: String(req.params.productId),
        customerId,
        texto,
        props,
        status: 'pending',
      },
    });

    res.json({ ok: true, id: rec.id });
  } catch (err) {
    console.error('[widget] personalization:', err.message);
    res.json({ ok: false });
  }
});

module.exports = router;
