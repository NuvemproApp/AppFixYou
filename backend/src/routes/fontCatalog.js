'use strict';
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/font-catalog — catálogo global de fontes (compartilhado por todas
// as lojas, curado pela Nuvempro). Usado pelo FontPicker do painel admin.
// webfontUrl aponta pro proxy em fontFile.js (mesmo backend), não direto
// pro R2 — ver o comentário lá pra entender por quê.
router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.fontCatalogItem.findMany({ orderBy: { family: 'asc' } });
    res.json({
      fonts: items.map((f) => ({
        id: f.id,
        family: f.family,
        webfontUrl: `${process.env.BACKEND_URL}/api/font-catalog/file/${f.webfontKey.split('/').pop()}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
