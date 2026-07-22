'use strict';
const express = require('express');
const { getObject } = require('../lib/r2');
const { AppError } = require('../lib/errors');

const router = express.Router();

// GET /api/font-catalog/file/:filename — proxy público do arquivo de fonte
// pelo próprio backend, SEM auth (@font-face/<link> não conseguem mandar
// Authorization header) e SEM rate limit global (o picker carrega ~50
// arquivos de uma vez ao abrir — o limite de 60 req/min por IP do resto da
// API estourava quase imediatamente e derrubava a maioria das fontes).
// Existe porque o bucket público do R2 (pub-*.r2.dev) não manda header
// CORS nenhum — sem isso, todo carregamento de fonte cross-origin falha em
// produção (funciona em localhost porque o Chrome relaxa essa checagem só
// pra esse origin, o que mascarou o bug durante o desenvolvimento). Servir
// pelo nosso próprio Express herda o CORS já configurado em server.js pro
// FRONTEND_URL, e o cache forte (immutable) evita re-requisitar o mesmo
// arquivo depois da primeira visita.
router.get('/:filename', async (req, res, next) => {
  try {
    if (!/^[\w.-]+\.(woff2|ttf)$/.test(req.params.filename)) {
      throw new AppError('Nome de arquivo inválido.', 400, 'INVALID_FILENAME');
    }
    const key = `fixyou_18058/_catalog/fonts/${req.params.filename}`;
    const obj = await getObject(key);
    res.set('Content-Type', obj.ContentType || 'font/woff2');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    obj.Body.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
