'use strict';
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getPublicUrl } = require('../lib/r2');

const router = express.Router();
router.use(requireAuth);

// GET /api/font-catalog — catálogo global de fontes (compartilhado por todas
// as lojas, curado pela Nuvempro). Usado pelo FontPicker do painel admin.
router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.fontCatalogItem.findMany({ orderBy: { family: 'asc' } });
    res.json({
      fonts: items.map((f) => ({
        id: f.id,
        family: f.family,
        webfontUrl: getPublicUrl(f.webfontKey),
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
