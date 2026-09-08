'use strict';

/**
 * Cliente do NuvemPro Partners — registro de LEADS (loja instalou, ainda sem
 * plano) + notificação de desinstalação. Complementa (não substitui) o metadata
 * de parceiro enviado na criação da assinatura no Stripe (config/stripe.js).
 *
 * Nunca lança para o chamador: em erro, apenas loga e segue ("fire-and-forget"),
 * com timeout curto. Uma indisponibilidade do Partners jamais pode quebrar o
 * fluxo do app (OAuth, billing, webhooks).
 *
 * Config por ambiente (com fallback para as envs que o app já tem):
 *   PARTNERS_API_URL   default https://partners.nuvempro.com
 *   PARTNERS_API_KEY   (obrigatória — sem ela, tudo vira no-op)
 *   PARTNERS_APP_SLUG  fallback: APP_SLUG
 *   PARTNERS_APP_NAME  fallback: APP_NAME
 *   PARTNERS_APP_ID    fallback: NUVEMSHOP_APP_ID  (faz o painel Partners cadastrar
 *                      o app sozinho no gerador de links de indicação)
 *
 * IMPORTANTE — chave de conciliação (`storeId`): use SEMPRE o mesmo valor que vai
 * no `store_id` do metadata da assinatura no Stripe. Neste app isso é o id INTERNO
 * do Store (`String(store.id)`), conforme config/stripe.js. O Partners concilia o
 * lead com a assinatura por (appSlug, storeId), então os dois têm que bater.
 */

const PARTNERS_API_URL = (process.env.PARTNERS_API_URL || 'https://partners.nuvempro.com').replace(/\/+$/, '');
const APP_SLUG = process.env.PARTNERS_APP_SLUG || process.env.APP_SLUG || null;
const APP_NAME = process.env.PARTNERS_APP_NAME || process.env.APP_NAME || null;
const APP_ID = process.env.PARTNERS_APP_ID || process.env.NUVEMSHOP_APP_ID || null;
const REQUEST_TIMEOUT_MS = 5000;

function apiKey() {
  return process.env.PARTNERS_API_KEY || null;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/** Requisição base ao Partners. Nunca lança: retorna o JSON ou `null`. */
async function callPartners(method, path, body) {
  if (!apiKey() || !APP_SLUG) {
    console.warn('[partners] PARTNERS_API_KEY/APP_SLUG ausentes — pulando', path);
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PARTNERS_API_URL}/api/v1${path}`, {
      method,
      headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[partners] ${method} ${path} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.warn(`[partners] ${method} ${path} falhou:`, err?.message || err);
    return null; // nunca quebra o fluxo do app
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Valida um código de parceiro. Retorna `{ ok, status, partner }` — nunca lança.
 * `partner` = corpo da resposta quando 200 (ex.: `{ partnerId, name }`).
 * Usado para confiar (ou não) num código vindo do `state` do OAuth.
 */
async function validatePartner(partnerId) {
  const code = normalizeCode(partnerId);
  if (code.length < 4 || !apiKey()) return { ok: false, status: 0, partner: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PARTNERS_API_URL}/api/v1/partners/${encodeURIComponent(code)}`, {
      headers: { 'x-api-key': apiKey() },
      signal: controller.signal,
    });
    const partner = res.ok ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, partner };
  } catch (err) {
    console.warn('[partners] validatePartner falhou:', err?.message || err);
    return { ok: false, status: 0, partner: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Registra/atualiza a loja como lead do parceiro (idempotente por appSlug+storeId).
 * Chame quando houver código de parceiro para a loja e ela ainda não assinou.
 * @param {{ partnerId:string, storeId:string|number, storeName?:string, storeUrl?:string, email?:string }} p
 */
async function registerPartnerLead(p) {
  const partnerId = normalizeCode(p?.partnerId);
  const storeId = String(p?.storeId ?? '').trim();
  if (partnerId.length < 4 || !storeId) return null; // sem código/loja válidos, não registra
  return callPartners('POST', '/referrals', {
    partnerId,
    appSlug: APP_SLUG,
    appName: APP_NAME,
    appId: APP_ID, // faz o Partners cadastrar o app sozinho no gerador de links
    storeId,
    storeName: p?.storeName ?? null,
    storeUrl: p?.storeUrl ?? null,
    email: p?.email ?? null,
  });
}

/** Marca o lead como desinstalado. Chame no webhook de app desinstalado. */
async function markPartnerUninstalled(storeId) {
  const id = String(storeId ?? '').trim();
  if (!id) return null;
  return callPartners('POST', '/referrals/uninstall', { appSlug: APP_SLUG, storeId: id });
}

module.exports = {
  validatePartner,
  registerPartnerLead,
  markPartnerUninstalled,
  normalizeCode,
};
