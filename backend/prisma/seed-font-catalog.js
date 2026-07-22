'use strict';
/**
 * Seed único do catálogo global de fontes (FontCatalogItem).
 *
 * Faz upload de cada par ttf+woff2 (curados a partir do zip de fontes do
 * usuário) pro R2 e cria/atualiza a linha correspondente no banco. Idempotente
 * — pode rodar de novo sem duplicar (upsert por `family`).
 *
 * Uso: node prisma/seed-font-catalog.js <pasta-com-webfont-kit>
 *   <pasta-com-webfont-kit> deve conter um par "<slug>.ttf" + "<slug>.woff2"
 *   por entrada listada em prisma/font-catalog-seed-data.json.
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const { uploadRaw, APP_PREFIX } = require('../src/lib/r2');

const CATALOG_PREFIX = `${APP_PREFIX}/_catalog/fonts`;

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Uso: node prisma/seed-font-catalog.js <pasta-com-webfont-kit>');
    process.exit(1);
  }

  const entries = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'font-catalog-seed-data.json'), 'utf8')
  );

  let ok = 0;
  let skipped = 0;

  for (const { slug, family } of entries) {
    const ttfPath = path.join(sourceDir, `${slug}.ttf`);
    const woff2Path = path.join(sourceDir, `${slug}.woff2`);

    if (!fs.existsSync(ttfPath) || !fs.existsSync(woff2Path)) {
      console.warn(`[seed-font-catalog] pulando "${family}" (${slug}) — arquivo faltando`);
      skipped++;
      continue;
    }

    const ttfKey = `${CATALOG_PREFIX}/${slug}.ttf`;
    const webfontKey = `${CATALOG_PREFIX}/${slug}.woff2`;

    await uploadRaw(ttfKey, fs.readFileSync(ttfPath), 'font/ttf');
    await uploadRaw(webfontKey, fs.readFileSync(woff2Path), 'font/woff2');

    await prisma.fontCatalogItem.upsert({
      where: { family },
      update: { ttfKey, webfontKey },
      create: { family, ttfKey, webfontKey },
    });

    ok++;
    console.log(`[seed-font-catalog] ok — ${family}`);
  }

  console.log(`\n[seed-font-catalog] concluído: ${ok} fontes, ${skipped} puladas.`);
}

main()
  .catch((err) => {
    console.error('[seed-font-catalog] erro fatal:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
