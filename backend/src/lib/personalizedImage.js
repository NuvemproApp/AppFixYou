'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, registerFont } = require('canvas');
const prisma = require('./prisma');
const { getObject, extractKey } = require('./r2');
const { MODELOS } = require('./fixyouModelos');

const MAX_TEXTO_LEN = 60;
const JPEG_OPTS = { quality: 0.92 };

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function loadR2Image(storedValue) {
  const key = extractKey(storedValue);
  if (!key) throw new Error('imagem sem key R2 válida');
  const obj = await getObject(key);
  const buffer = await streamToBuffer(obj.Body);
  return loadImage(buffer);
}

// Registro de fonte é global/irreversível no processo do node-canvas — cacheia
// por FontCatalogItem.id (catálogo é compartilhado entre lojas, então o mesmo
// arquivo só precisa ser baixado/registrado uma vez na vida do processo). O
// Map guarda a Promise (não o resultado) pra chamadas concorrentes com o
// mesmo id aguardarem o mesmo registro em vez de descarregar/registrar 2x.
const _fontRegistrations = new Map();

async function ensureFontFamily(fontCatalogItem) {
  if (_fontRegistrations.has(fontCatalogItem.id)) return _fontRegistrations.get(fontCatalogItem.id);

  const promise = (async () => {
    const obj = await getObject(fontCatalogItem.ttfKey);
    const buffer = await streamToBuffer(obj.Body);
    const tmpPath = path.join(os.tmpdir(), `fixyou-font-${fontCatalogItem.id}.ttf`);
    await fs.promises.writeFile(tmpPath, buffer);
    registerFont(tmpPath, { family: fontCatalogItem.family });
    return fontCatalogItem.family;
  })();

  _fontRegistrations.set(fontCatalogItem.id, promise);
  return promise;
}

async function fontFamilyFor(fonteItem) {
  const fontCatalogItemId = fonteItem.valor && fonteItem.valor.fontCatalogItemId;
  const catalogItem = await prisma.fontCatalogItem.findUnique({ where: { id: Number(fontCatalogItemId) } });
  if (!catalogItem) throw new Error('fonte não encontrada no catálogo');
  return ensureFontFamily(catalogItem);
}

// allowedIds restringe aos itens que o admin de fato selecionou pra ESSE
// produto na tela PersonalizacoesProduto — sem isso, qualquer item ativo da
// mesma categoria em QUALQUER produto da loja seria aceito aqui (a query já
// filtra por storeId+categoria+ativo, mas não por produto), permitindo montar
// uma prévia com combinações nunca disponibilizadas para este produto
// específico via uma URL manual.
async function fetchItem(storeId, id, categoria, allowedIds) {
  if (!id) return null;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;
  if (!allowedIds.has(numId)) return null;
  return prisma.personalizationItem.findFirst({
    where: { id: numId, storeId, categoria, ativo: true },
  });
}

async function fetchAllowedIds(storeId, productId) {
  const rows = await prisma.productPersonalizationItem.findMany({
    where: { storeId, productId: String(productId) },
    select: { personalizationItemId: true },
  });
  return new Set(rows.map((r) => r.personalizationItemId));
}

// ─── Quebra de texto em linhas que respeitem maxWidth (equivalente ao
// word-wrap automático de RectangleF+StringFormat do GDI+/System.Drawing) ───
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? current + ' ' + word : word;
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Desenha texto centralizado (horizontal e verticalmente) dentro de um
// retângulo — equivalente ao StringFormat{Alignment=Center,LineAlignment=Center}
// aplicado a um RectangleF no GDI+.
function drawCenteredBlock(ctx, text, rect, fontSize) {
  const lines = wrapLines(ctx, text, rect.width);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lines.length * lineHeight;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = rect.y + (rect.height - blockHeight) / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, rect.x + rect.width / 2, y);
    y += lineHeight;
  }
}

function blankImage() {
  const canvas = createCanvas(1200, 1200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 1200);
  return canvas.toBuffer('image/jpeg', JPEG_OPTS);
}

// ─── Modelo Mesclado: ícone + texto lado a lado, em mosaico com offset ──────
// (linhas ímpares deslocadas em meio elemento), sobre a imagem de fundo.
async function generateMesclado({ texto, fonte, corDeFonte, icone, fundo }) {
  const [iconImg, fundoImg, fontFamily] = await Promise.all([
    loadR2Image(icone.valor),
    loadR2Image(fundo.valor),
    fontFamilyFor(fonte),
  ]);

  const width = 800, height = 600, tamanho = 40;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(fundoImg, 0, 0, width, height);

  ctx.font = `${tamanho}px "${fontFamily}"`;
  ctx.fillStyle = corDeFonte.valor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(texto).width + 1;
  const textHeight = tamanho + 1;
  const elementoAltura = Math.max(textHeight, iconImg.height);
  const elementoComprimento = iconImg.width + textWidth + 32;

  const linhas = Math.floor(height / elementoAltura) + 2;
  const colunas = Math.floor(width / elementoComprimento) + 2;

  for (let i = 0; i < linhas; i++) {
    let x = (i % 2 === 0) ? 0 : -elementoComprimento / 2;
    const y = i * (elementoAltura + 16);
    for (let j = 0; j < colunas; j++) {
      ctx.drawImage(iconImg, x, y);
      x += iconImg.width + 4;
      ctx.fillText(texto, x, y + iconImg.height / 2 + 8);
      x += textWidth + 28;
    }
  }

  return canvas.toBuffer('image/jpeg', JPEG_OPTS);
}

// ─── Modelo Texto Somente: texto em mosaico, cor alternando entre as 4 do
// conjunto de cores escolhido (grade 2x2 por linha/coluna par/ímpar) ─────────
async function generateTextoSomente({ texto, fonte, conjuntoDeCores, fundo }) {
  const [fundoImg, fontFamily] = await Promise.all([
    loadR2Image(fundo.valor),
    fontFamilyFor(fonte),
  ]);

  const cores = conjuntoDeCores.valor;
  if (!Array.isArray(cores) || cores.length !== 4) throw new Error('conjunto de cores inválido');

  const width = 800, height = 600, tamanho = 40;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(fundoImg, 0, 0, width, height);

  ctx.font = `${tamanho}px "${fontFamily}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(texto).width + 1;
  const textHeight = tamanho + 1;

  const linhas = Math.floor(height / textHeight) + 2;
  const colunas = Math.floor(width / textWidth) + 2;

  for (let i = 0; i < linhas; i++) {
    let x = (i % 2 === 0) ? 0 : -textWidth / 2;
    const y = i * (textHeight + 16);
    for (let j = 0; j < colunas; j++) {
      ctx.fillStyle = cores[(i % 2 === 0 ? 0 : 2) + (j % 2 === 0 ? 0 : 1)];
      ctx.fillText(texto, x + textWidth / 2, y + textHeight / 2);
      x += textWidth + 28;
    }
  }

  return canvas.toBuffer('image/jpeg', JPEG_OPTS);
}

// ─── Modelo Centralizado: texto único, centralizado sobre o pattern ─────────
async function generateCentralizado({ texto, fonte, corDeFonte, pattern }) {
  const [patternImg, fontFamily] = await Promise.all([
    loadR2Image(pattern.valor),
    fontFamilyFor(fonte),
  ]);

  const tamanho = 80;
  const canvas = createCanvas(patternImg.width, patternImg.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(patternImg, 0, 0);

  ctx.font = `${tamanho}px "${fontFamily}"`;
  ctx.fillStyle = corDeFonte.valor;
  drawCenteredBlock(ctx, texto, { x: 250, y: 250, width: 500, height: 425 }, tamanho);

  return canvas.toBuffer('image/jpeg', JPEG_OPTS);
}

// ─── Modelo Texto Duplicado: mesmo texto em 2 blocos sobre o pattern ────────
async function generateTextoDuplicado({ texto, fonte, corDeFonte, pattern }) {
  const [patternImg, fontFamily] = await Promise.all([
    loadR2Image(pattern.valor),
    fontFamilyFor(fonte),
  ]);

  const tamanho = 64;
  const canvas = createCanvas(patternImg.width, patternImg.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(patternImg, 0, 0);

  ctx.font = `${tamanho}px "${fontFamily}"`;
  ctx.fillStyle = corDeFonte.valor;
  drawCenteredBlock(ctx, texto, { x: 50, y: 125, width: 550, height: 250 }, tamanho);
  drawCenteredBlock(ctx, texto, { x: 400, y: 450, width: 550, height: 250 }, tamanho);

  return canvas.toBuffer('image/jpeg', JPEG_OPTS);
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
// ids: { fonte, corDeFonte, icone, fundo, conjuntoDeCores, pattern } — cada um
// é o id numérico (PersonalizationItem.id) que o widget enviou, ou undefined
// se aquele campo não se aplica ao modelo atual. Qualquer falha (item não
// encontrado, imagem/fonte indisponível, etc.) cai no fallback de imagem
// branca — nunca deixa a requisição sem uma imagem válida de resposta, mesmo
// resultado do C# legado (`catch` retornando bitmap branco 1200x1200).
async function generatePersonalizedImage({ storeId, productId, modelo, texto, ids }) {
  try {
    const safeTexto = String(texto || '').trim().slice(0, MAX_TEXTO_LEN);
    if (!safeTexto) throw new Error('texto vazio');

    const allowedIds = await fetchAllowedIds(storeId, productId);

    if (modelo === MODELOS.MESCLADO) {
      const [fonte, corDeFonte, icone, fundo] = await Promise.all([
        fetchItem(storeId, ids.fonte, 'fontes', allowedIds),
        fetchItem(storeId, ids.corDeFonte, 'coresDeFonte', allowedIds),
        fetchItem(storeId, ids.icone, 'icones', allowedIds),
        fetchItem(storeId, ids.fundo, 'imagensDeFundo', allowedIds),
      ]);
      if (!fonte || !corDeFonte || !icone || !fundo) throw new Error('personalização incompleta (mesclado)');
      return await generateMesclado({ texto: safeTexto, fonte, corDeFonte, icone, fundo });
    }

    if (modelo === MODELOS.TEXTO_SOMENTE) {
      const [fonte, conjuntoDeCores, fundo] = await Promise.all([
        fetchItem(storeId, ids.fonte, 'fontes', allowedIds),
        fetchItem(storeId, ids.conjuntoDeCores, 'conjuntosDeCores', allowedIds),
        fetchItem(storeId, ids.fundo, 'imagensDeFundo', allowedIds),
      ]);
      if (!fonte || !conjuntoDeCores || !fundo) throw new Error('personalização incompleta (texto somente)');
      return await generateTextoSomente({ texto: safeTexto, fonte, conjuntoDeCores, fundo });
    }

    if (modelo === MODELOS.CENTRALIZADO) {
      const [fonte, corDeFonte, pattern] = await Promise.all([
        fetchItem(storeId, ids.fonte, 'fontes', allowedIds),
        fetchItem(storeId, ids.corDeFonte, 'coresDeFonte', allowedIds),
        fetchItem(storeId, ids.pattern, 'patterns', allowedIds),
      ]);
      if (!fonte || !corDeFonte || !pattern) throw new Error('personalização incompleta (centralizado)');
      return await generateCentralizado({ texto: safeTexto, fonte, corDeFonte, pattern });
    }

    if (modelo === MODELOS.TEXTO_DUPLICADO) {
      const [fonte, corDeFonte, pattern] = await Promise.all([
        fetchItem(storeId, ids.fonte, 'fontes', allowedIds),
        fetchItem(storeId, ids.corDeFonte, 'coresDeFonte', allowedIds),
        fetchItem(storeId, ids.pattern, 'patterns', allowedIds),
      ]);
      if (!fonte || !corDeFonte || !pattern) throw new Error('personalização incompleta (texto duplicado)');
      return await generateTextoDuplicado({ texto: safeTexto, fonte, corDeFonte, pattern });
    }

    throw new Error('modelo desconhecido: ' + modelo);
  } catch (err) {
    console.error('[personalizedImage] fallback para imagem branca:', err.message);
    return blankImage();
  }
}

module.exports = { generatePersonalizedImage, blankImage };
