const axios = require('axios');

const NUVEMSHOP_AUTH_URL = 'https://www.tiendanube.com/apps/authorize/token';
const NUVEMSHOP_API_BASE = 'https://api.tiendanube.com/v1';

/**
 * Exchange authorization code for access token via Nuvemshop OAuth.
 */
async function exchangeCodeForToken(code) {
  const response = await axios.post(NUVEMSHOP_AUTH_URL, {
    client_id: process.env.NUVEMSHOP_CLIENT_ID,
    client_secret: process.env.NUVEMSHOP_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
  });

  return {
    accessToken: response.data.access_token,
    userId: String(response.data.user_id),
    tokenType: response.data.token_type,
  };
}

/**
 * Create an authenticated Nuvemshop API client for a specific store.
 * Uses "Authentication" header as required by Nuvemshop API.
 */
function createNuvemshopClient(storeNuvemshopId, accessToken) {
  const client = axios.create({
    baseURL: `${NUVEMSHOP_API_BASE}/${storeNuvemshopId}`,
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': `${process.env.APP_NAME || 'NuvemProApp'} (${process.env.APP_EMAIL || 'contato@app.com'})`,
    },
    timeout: 15000,
  });

  return client;
}

/**
 * Fetch store info from Nuvemshop API.
 */
async function fetchStoreInfo(storeNuvemshopId, accessToken) {
  const client = createNuvemshopClient(storeNuvemshopId, accessToken);
  const response = await client.get('/store');
  return response.data;
}

/**
 * Busca um pedido (com os line items em `products`: product_id, variant_id,
 * quantity, name, properties). Usado pelo webhook order/created para casar as
 * personalizações capturadas na vitrine com o pedido.
 */
async function fetchOrder(storeNuvemshopId, accessToken, orderId) {
  const client = createNuvemshopClient(storeNuvemshopId, accessToken);
  const response = await client.get(`/orders/${orderId}`);
  return response.data;
}

/**
 * Sobrescreve a nota do lojista (`owner_note`) do pedido. O chamador deve
 * fazer o append (ler a nota atual antes) — a API não tem append nativo.
 */
async function updateOrderOwnerNote(storeNuvemshopId, accessToken, orderId, ownerNote) {
  const client = createNuvemshopClient(storeNuvemshopId, accessToken);
  const response = await client.put(`/orders/${orderId}`, { owner_note: ownerNote });
  return response.data;
}

/**
 * URL pública do backend (onde a Nuvemshop entrega os webhooks).
 */
function backendUrl() {
  return (process.env.BACKEND_URL || 'https://api.fixyou.nuvempro.com').replace(/\/+$/, '');
}

/**
 * Registra (idempotente) os webhooks que o app precisa receber da Nuvemshop.
 * Hoje: `order/created` → POST /webhooks/orders/created (usado para casar a
 * personalização capturada na vitrine com o pedido e escrever o resumo no
 * owner_note). Best-effort: lista os existentes e só cria o que falta.
 *
 * @returns {Promise<{created:string[], existing:string[], errors:string[]}>}
 */
async function registerAppWebhooks(storeNuvemshopId, accessToken) {
  const client = createNuvemshopClient(storeNuvemshopId, accessToken);
  const result = { created: [], existing: [], errors: [] };

  const desired = [
    { event: 'order/created', url: `${backendUrl()}/webhooks/orders/created` },
  ];

  let current = [];
  try {
    const res = await client.get('/webhooks');
    current = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    // Sem a lista seguimos tentando criar (duplicado retorna erro tratável).
    result.errors.push(`list: ${err.response?.status || err.message}`);
  }

  for (const w of desired) {
    const hit = current.find((c) => c.event === w.event && c.url === w.url);
    if (hit) { result.existing.push(w.event); continue; }
    try {
      await client.post('/webhooks', w);
      result.created.push(w.event);
    } catch (err) {
      // 422 costuma ser "já existe" (event+url duplicado) → trata como existente.
      const status = err.response?.status;
      if (status === 422) result.existing.push(w.event);
      else result.errors.push(`${w.event}: ${status || err.message}`);
    }
  }
  return result;
}

module.exports = {
  exchangeCodeForToken,
  createNuvemshopClient,
  fetchStoreInfo,
  fetchOrder,
  updateOrderOwnerNote,
  registerAppWebhooks,
  NUVEMSHOP_API_BASE,
  NUVEMSHOP_AUTH_URL,
};
