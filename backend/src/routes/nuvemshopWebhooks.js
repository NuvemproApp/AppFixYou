const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { markPartnerUninstalled } = require('../lib/partners');
const { fetchOrder, updateOrderOwnerNote } = require('../config/nuvemshop');

const router = express.Router();

/**
 * Valida o HMAC do webhook (header x-linkedstore-hmac-sha256 = HMAC-SHA256 do raw
 * body com o client_secret). Tolerante a encoding (hex ou base64) e timing-safe.
 * Retorna: true = confere | false = header presente mas NÃO confere | null = não
 * dá para verificar (sem secret/header/raw body — ex.: chamada manual/dev).
 *
 * IMPORTANTE: todo handler que muta dados deve exigir `checkHmac(req) === true`
 * (nunca apenas `!== false`) — `null` significa "não verificável", não "confie
 * mesmo assim". Tratar `null` como passável permite que qualquer requisição sem
 * o header de assinatura seja aceita como se fosse da Nuvemshop.
 */
function checkHmac(req) {
  const secret = process.env.NUVEMSHOP_CLIENT_SECRET;
  const header = req.headers['x-linkedstore-hmac-sha256'];
  if (!secret || !header || !req.rawBody) return null;
  const hex = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const b64 = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  const safeEq = (a, b) => {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };
  return safeEq(header, hex) || safeEq(header, b64);
}

/**
 * Webhooks da Nuvemshop. Configurados no Partner Portal apontando para estas URLs.
 * Body: { store_id, event } (JSON). Responder 200 é obrigatório para a homologação.
 *
 * HMAC (header x-linkedstore-hmac-sha256) é hardening futuro — exige raw body nesta
 * rota. Por ora processamos sem verificação estrita: as ações são não-destrutivas
 * (apenas sinalizam a desinstalação; a exclusão de dados é manual no admin).
 */

// Marca a data de desinstalação na loja. Idempotente: não sobrescreve data anterior.
// Também notifica o NuvemPro Partners (best-effort) quando a loja tinha parceiro
// vinculado, para o lead sair da lista do parceiro. `storeId` do webhook é o
// nuvemshopId; ao Partners enviamos o id INTERNO do Store (mesma chave do lead).
async function markUninstalled(nuvemshopId) {
  if (!nuvemshopId) return;
  try {
    const store = await prisma.store.findUnique({
      where: { nuvemshopId: String(nuvemshopId) },
      select: { id: true, partnerId: true, uninstalledAt: true },
    });
    if (!store) return;
    if (!store.uninstalledAt) {
      await prisma.store.update({ where: { id: store.id }, data: { uninstalledAt: new Date() } });
    }
    if (store.partnerId) markPartnerUninstalled(store.id); // fire-and-forget
  } catch (err) {
    console.error('[nuvemshop-webhook] markUninstalled falhou:', err.message);
  }
}

/**
 * POST /webhooks/app/uninstalled — a loja desinstalou o app.
 */
router.post('/app/uninstalled', async (req, res) => {
  if (checkHmac(req) !== true) {
    console.warn('[nuvemshop] app/uninstalled sem HMAC válido — ignorado');
    return res.status(401).json({ error: 'Invalid HMAC.' });
  }
  const storeId = req.body?.store_id;
  console.log(`[nuvemshop] app/uninstalled store_id=${storeId}`);
  await markUninstalled(storeId);
  res.status(200).json({ success: true });
});

/**
 * POST /webhooks/store/redact — LGPD: solicitação de exclusão ~48h após desinstalação.
 * Também marca a desinstalação (rede de segurança caso app/uninstalled não chegue).
 */
router.post('/store/redact', async (req, res) => {
  // LGPD exige sempre 200 (homologação) — em HMAC inválido apenas logamos e
  // NÃO marcamos a desinstalação, evitando poluição por requisição forjada.
  const hmac = checkHmac(req);
  const storeId = req.body?.store_id;
  console.log(`[nuvemshop][LGPD] store/redact store_id=${storeId} hmac=${hmac}`);
  if (hmac === true) await markUninstalled(storeId);
  res.status(200).json({ success: true });
});

/**
 * POST /webhooks/customers/redact — LGPD (não armazenamos PII de clientes da loja).
 */
router.post('/customers/redact', (req, res) => {
  console.log(`[nuvemshop][LGPD] customers/redact store_id=${req.body?.store_id}`);
  res.status(200).json({ success: true });
});

/**
 * POST /webhooks/customers/data_request — LGPD (não armazenamos PII de clientes da loja).
 */
router.post('/customers/data_request', (req, res) => {
  console.log(`[nuvemshop][LGPD] customers/data_request store_id=${req.body?.store_id}`);
  res.status(200).json({ success: true, data: [] });
});

// ─── FixYou NubeSDK: casa as personalizações capturadas na vitrine com o pedido ─
// No NubeSDK o cart:add não carrega properties de linha, então a personalização
// é gravada (pending) quando o cliente adiciona ao carrinho e vinculada aqui ao
// pedido. Correlação: mesma loja+produto, status pending, recente (24h), com
// prioridade pra quem tem o mesmo customerId; FIFO por data; até `quantity` por
// item de linha. É idempotente (retry do Stripe/Nuvemshop não duplica): só pega
// pending e só anexa a nota se o bloco [FixYou] ainda não estiver nela.
const CAPTURE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function attachPersonalizationsToOrder(nuvemshopId, orderId) {
  const store = await prisma.store.findUnique({
    where: { nuvemshopId: String(nuvemshopId) },
    select: { id: true, accessToken: true },
  });
  if (!store || !store.accessToken) return;

  let order;
  try {
    order = await fetchOrder(nuvemshopId, store.accessToken, orderId);
  } catch (err) {
    console.warn('[nuvemshop] orders/created: fetch do pedido falhou:', err.message);
    throw err; // deixa o Nuvemshop reenviar
  }

  const products = Array.isArray(order.products) ? order.products : [];
  if (!products.length) return;
  const orderCustomerId = order.customer && order.customer.id ? String(order.customer.id) : null;
  const since = new Date(Date.now() - CAPTURE_WINDOW_MS);

  const matched = []; // { capture, lineName }
  const usedIds = {};
  for (const li of products) {
    const productId = String(li.product_id || '');
    if (!productId) continue;
    const qty = Number(li.quantity) || 1;

    const candidates = await prisma.personalizationCapture.findMany({
      where: { storeId: store.id, productId, status: 'pending', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const ranked = candidates
      .filter((c) => !usedIds[c.id])
      .sort((a, b) => {
        const am = orderCustomerId && a.customerId === orderCustomerId ? 0 : 1;
        const bm = orderCustomerId && b.customerId === orderCustomerId ? 0 : 1;
        if (am !== bm) return am - bm;
        return a.createdAt - b.createdAt;
      });

    for (const c of ranked.slice(0, qty)) {
      usedIds[c.id] = true;
      matched.push({ capture: c, lineName: li.name || productId });
    }
  }

  if (!matched.length) return;

  await prisma.personalizationCapture.updateMany({
    where: { id: { in: matched.map((m) => m.capture.id) } },
    data: { status: 'matched', orderId: String(orderId), matchedAt: new Date() },
  });

  // Anexa o resumo ao owner_note do pedido (idempotente pelo marcador [FixYou]).
  const lines = matched.map((m) => {
    const p = m.capture.props || {};
    const parts = Object.keys(p).map((k) => k + ': ' + p[k]);
    return '• ' + m.lineName + ' — ' + parts.join(' | ');
  });
  const block = '[FixYou] Personalizacoes:\n' + lines.join('\n');
  const existing = String(order.owner_note || '').trim();
  if (existing.indexOf('[FixYou] Personalizacoes') === -1) {
    const note = (existing ? existing + '\n\n' + block : block).slice(0, 4000);
    try {
      await updateOrderOwnerNote(nuvemshopId, store.accessToken, orderId, note);
    } catch (err) {
      console.warn('[nuvemshop] orders/created: update do owner_note falhou:', err.message);
    }
  }
}

/**
 * POST /webhooks/orders/created — pedido criado. Casa as personalizações.
 * Registre esta URL para o evento `order/created` no Portal de Parceiros.
 */
router.post('/orders/created', async (req, res) => {
  if (checkHmac(req) !== true) {
    console.warn('[nuvemshop] orders/created sem HMAC válido — ignorado');
    return res.status(401).json({ error: 'Invalid HMAC.' });
  }
  const storeId = req.body?.store_id;
  const orderId = req.body?.id;
  console.log(`[nuvemshop] orders/created store_id=${storeId} order=${orderId}`);
  if (!storeId || !orderId) return res.status(200).json({ success: true });
  try {
    await attachPersonalizationsToOrder(storeId, orderId);
    res.status(200).json({ success: true });
  } catch (err) {
    // 500 → Nuvemshop reenvia (o processamento é idempotente)
    console.error('[nuvemshop] orders/created falhou:', err.message);
    res.status(500).json({ error: 'processing_failed' });
  }
});

module.exports = router;
