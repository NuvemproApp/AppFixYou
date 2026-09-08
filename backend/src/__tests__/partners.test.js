'use strict';

// APP_SLUG/APP_NAME/APP_ID são lidos no import do módulo — definir ANTES do require.
process.env.APP_SLUG = 'fixyou-test';
process.env.APP_NAME = 'FixYou Test';
process.env.NUVEMSHOP_APP_ID = '18058';

const { describe, it, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  registerPartnerLead,
  markPartnerUninstalled,
  validatePartner,
  normalizeCode,
} = require('../lib/partners');

const ORIG_KEY = process.env.PARTNERS_API_KEY;
const origFetch = global.fetch;
let fetchCalls;

function mockFetch(impl) {
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return impl ? impl(url, opts) : { ok: true, status: 200, json: async () => ({}) };
  };
}

beforeEach(() => { fetchCalls = []; });
afterEach(() => {
  global.fetch = origFetch;
  if (ORIG_KEY === undefined) delete process.env.PARTNERS_API_KEY;
  else process.env.PARTNERS_API_KEY = ORIG_KEY;
});

describe('lib/partners — leads (best-effort, nunca lança)', () => {
  it('normalizeCode faz trim + uppercase', () => {
    assert.strictEqual(normalizeCode('  e5dchv87 '), 'E5DCHV87');
    assert.strictEqual(normalizeCode(null), '');
  });

  it('registerPartnerLead sem PARTNERS_API_KEY → no-op (não chama fetch)', async () => {
    delete process.env.PARTNERS_API_KEY;
    mockFetch();
    const r = await registerPartnerLead({ partnerId: 'E5DCHV87', storeId: 42 });
    assert.strictEqual(r, null);
    assert.strictEqual(fetchCalls.length, 0);
  });

  it('registerPartnerLead com key → POST /referrals com payload e headers corretos', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    const r = await registerPartnerLead({
      partnerId: ' e5dchv87 ', storeId: 42, storeName: 'Loja', storeUrl: 'https://x.com', email: 'a@b.com',
    });
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(fetchCalls.length, 1);
    const { url, opts } = fetchCalls[0];
    assert.match(url, /\/api\/v1\/referrals$/);
    assert.strictEqual(opts.method, 'POST');
    assert.strictEqual(opts.headers['x-api-key'], 'nv_live_test');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.partnerId, 'E5DCHV87'); // normalizado
    assert.strictEqual(body.storeId, '42');         // sempre string
    assert.strictEqual(body.appSlug, 'fixyou-test');
    assert.strictEqual(body.appId, '18058');
  });

  it('registerPartnerLead com código curto/ausente → não chama fetch', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch();
    assert.strictEqual(await registerPartnerLead({ partnerId: 'AB', storeId: 42 }), null);
    assert.strictEqual(await registerPartnerLead({ partnerId: 'E5DCHV87', storeId: '' }), null);
    assert.strictEqual(fetchCalls.length, 0);
  });

  it('registerPartnerLead nunca lança quando o fetch falha', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch(() => { throw new Error('network down'); });
    const r = await registerPartnerLead({ partnerId: 'E5DCHV87', storeId: 42 });
    assert.strictEqual(r, null); // engoliu o erro
  });

  it('markPartnerUninstalled sem storeId → no-op', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch();
    const r = await markPartnerUninstalled('');
    assert.strictEqual(r, null);
    assert.strictEqual(fetchCalls.length, 0);
  });

  it('markPartnerUninstalled com id → POST /referrals/uninstall', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    await markPartnerUninstalled(42);
    assert.strictEqual(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/api\/v1\/referrals\/uninstall$/);
    assert.strictEqual(JSON.parse(fetchCalls[0].opts.body).storeId, '42');
  });

  it('validatePartner (200) → { ok:true, status:200, partner }', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ partnerId: 'E5DCHV87', name: 'Fulano' }) }));
    const r = await validatePartner('e5dchv87');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.partner, { partnerId: 'E5DCHV87', name: 'Fulano' });
    assert.match(fetchCalls[0].url, /\/api\/v1\/partners\/E5DCHV87$/);
  });

  it('validatePartner (404) → { ok:false, status:404, partner:null }', async () => {
    process.env.PARTNERS_API_KEY = 'nv_live_test';
    mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
    const r = await validatePartner('E5DCHV87');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.partner, null);
  });
});
