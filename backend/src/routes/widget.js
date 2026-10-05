'use strict';
const express = require('express');
const path = require('path');

const router = express.Router();

// ─── Script do app NubeSDK (worker). O helmet() global aplica CORP/COEP
// restritivos a TODA resposta; liberamos aqui para o worker ser carregado
// cross-origin a partir do domínio da loja.
router.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
router.options('*', (_req, res) => res.sendStatus(204));

const PUBLIC = path.join(__dirname, '..', '..', 'public');

// ─── Script do app NubeSDK (worker). Registre esta URL no Portal de Parceiros
// com a flag "Usa Nube SDK": https://api.fixyou.nuvempro.com/widget/app.js
router.get('/app.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.sendFile(path.join(PUBLIC, 'nubesdk.min.js'));
});

// (Obsoleto e removido: a captura POST /personalization + o webhook order/created
// → owner_note. A personalização agora vai como `properties` de linha nativas no
// cart:add, aparecendo no carrinho e no pedido por item — sem anotação no pedido.)

module.exports = router;
