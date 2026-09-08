const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/errors');
const { registerPartnerLead } = require('../lib/partners');

// Re-registra o lead no Partners quando a loja tem parceiro vinculado — cobre
// lojas JÁ instaladas (sem backfill manual), pois o registro é idempotente. É
// throttled em memória (1x por loja a cada 6h) e fire-and-forget: só uma chamada
// HTTP externa, nunca toca o banco (não afeta o scale-to-zero do Neon) nem
// bloqueia a request.
const _leadThrottle = new Map();
const LEAD_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6h

function maybeRegisterLead(store) {
  if (!store?.partnerId) return;
  const now = Date.now();
  if (now - (_leadThrottle.get(store.id) || 0) < LEAD_THROTTLE_MS) return;
  _leadThrottle.set(store.id, now);
  registerPartnerLead({
    partnerId: store.partnerId,
    storeId: store.id,
    storeName: store.name,
    storeUrl: store.domain ? `https://${store.domain}` : null,
    email: store.email,
  });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Token nao fornecido.', 401, 'UNAUTHORIZED');
    }

    const token = header.slice(7);
    let payload;
    let isNexoToken = false;

    // Tenta verificar com JWT_SECRET (tokens gerados pelo backend)
    // Se falhar, tenta NUVEMSHOP_CLIENT_SECRET (tokens do Nexo SDK)
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e1) {
      try {
        payload = jwt.verify(token, process.env.NUVEMSHOP_CLIENT_SECRET);
        isNexoToken = true;
      } catch (e2) {
        throw new AppError('Token invalido ou expirado.', 401, 'INVALID_TOKEN');
      }
    }

    let store;

    if (isNexoToken) {
      // Token do Nexo SDK: storeId é o nuvemshopId (userId da Nuvemshop)
      const nuvemshopId = String(payload.storeId || payload.store_id || payload.sub || '');
      if (!nuvemshopId || nuvemshopId === 'undefined') {
        throw new AppError('store_id ausente no token.', 401, 'MISSING_STORE_ID');
      }
      store = await prisma.store.findUnique({
        where: { nuvemshopId },
        include: { subscription: true },
      });
    } else {
      // Token do backend: storeId é o id interno do banco
      store = await prisma.store.findUnique({
        where: { id: payload.storeId },
        include: { subscription: true },
      });
    }

    if (!store || !store.accessToken) {
      throw new AppError('Loja nao encontrada. Reinstale o app.', 401, 'STORE_NOT_FOUND');
    }

    // Sincroniza plan com a assinatura ativa se necessário
    const activeSub = store.subscription;
    if (activeSub?.status === 'active' && activeSub?.planKey && activeSub.planKey !== store.plan) {
      await prisma.store.update({ where: { id: store.id }, data: { plan: activeSub.planKey } });
      store.plan = activeSub.planKey;
    }

    req.store = store;
    req.storeId = store.id;
    maybeRegisterLead(store); // idempotente + throttled; não aguarda
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Erro interno de autenticacao.', code: 'AUTH_ERROR' });
  }
}

module.exports = { requireAuth };
