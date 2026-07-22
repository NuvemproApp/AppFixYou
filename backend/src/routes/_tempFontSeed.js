'use strict';
// TEMPORÁRIO — seed único do catálogo global de fontes via upload multipart,
// pra evitar expor credenciais R2 fora do container. Remover este arquivo +
// a linha de mount em server.js + a env var SEED_SECRET depois de rodar.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../lib/prisma');
const { uploadRaw, APP_PREFIX } = require('../lib/r2');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function checkSecret(req, res, next) {
  if (!process.env.SEED_SECRET || req.headers['x-seed-secret'] !== process.env.SEED_SECRET) {
    return res.status(404).end();
  }
  next();
}

router.get('/ping', checkSecret, (req, res) => res.json({ ok: true }));

router.post('/item', checkSecret, upload.fields([{ name: 'ttf', maxCount: 1 }, { name: 'webfont', maxCount: 1 }]), async (req, res, next) => {
  try {
    const { family, slug } = req.body;
    const ttfFile = req.files?.ttf?.[0];
    const webfontFile = req.files?.webfont?.[0];
    if (!family || !slug || !ttfFile || !webfontFile) {
      return res.status(400).json({ error: 'family, slug, ttf e webfont são obrigatórios.' });
    }

    const ttfKey = `${APP_PREFIX}/_catalog/fonts/${slug}.ttf`;
    const webfontKey = `${APP_PREFIX}/_catalog/fonts/${slug}.woff2`;

    await uploadRaw(ttfKey, ttfFile.buffer, 'font/ttf');
    await uploadRaw(webfontKey, webfontFile.buffer, 'font/woff2');

    await prisma.fontCatalogItem.upsert({
      where: { family },
      update: { ttfKey, webfontKey },
      create: { family, ttfKey, webfontKey },
    });

    res.json({ ok: true, family });
  } catch (err) { next(err); }
});

module.exports = router;
