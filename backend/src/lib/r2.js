'use strict';
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

// Prefixo fixo — nunca alterar
const APP_PREFIX = 'fixyou_18058';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function extractKey(stored) {
  if (!stored) return null;
  if (!stored.startsWith('http')) return stored;

  const r2Match = stored.match(/cloudflarestorage\.com\/[^/?]+\/([^?]+)/);
  if (r2Match) return r2Match[1];

  const pub = process.env.R2_PUBLIC_URL;
  if (pub && stored.startsWith(pub + '/')) return stored.slice(pub.length + 1);

  return null;
}

async function getPresignedUrl(stored, expiresIn = 3600) {
  if (!stored) return null;
  const key = extractKey(stored);
  if (!key) return null;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return null;
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    );
  } catch (err) {
    console.error('[r2] presign error:', err.message);
    return null;
  }
}

function getPublicUrl(stored) {
  if (!stored) return null;
  const key = extractKey(stored);
  if (!key) return null;
  const pub = process.env.R2_PUBLIC_URL;
  if (!pub) return null;
  return `${pub}/${key}`;
}

async function uploadToR2(buffer, originalname, mimetype, storeSerial, nuvemshopId) {
  const bucket    = process.env.R2_BUCKET_NAME;
  const account   = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !account || !accessKey || !secretKey) {
    const missing = [
      !bucket     && 'R2_BUCKET_NAME',
      !account    && 'R2_ACCOUNT_ID',
      !accessKey  && 'R2_ACCESS_KEY_ID',
      !secretKey  && 'R2_SECRET_ACCESS_KEY',
    ].filter(Boolean).join(', ');
    throw new Error(`[r2] env vars ausentes: ${missing}`);
  }

  const ext  = path.extname(originalname).toLowerCase() || '.jpg';
  const uuid = crypto.randomUUID();
  const key  = `${APP_PREFIX}/${storeSerial}/${nuvemshopId}/${uuid}${ext}`;

  console.log(`[r2] upload → bucket=${bucket} key=${key} mime=${mimetype} size=${buffer.length}b`);

  await client.send(new PutObjectCommand({
    Bucket:       bucket,
    Key:          key,
    Body:         buffer,
    ContentType:  mimetype,
    CacheControl: 'public, max-age=31536000',
  }));

  console.log(`[r2] upload ok → ${key}`);
  return key;
}

/**
 * Faz upload de um buffer pra uma key EXPLÍCITA (sem uuid/storeSerial) —
 * usado por assets globais/compartilhados entre lojas, como o catálogo de
 * fontes (curado pela Nuvempro, não por upload do lojista).
 */
async function uploadRaw(key, buffer, mimetype) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('[r2] R2_BUCKET_NAME ausente');

  await client.send(new PutObjectCommand({
    Bucket:       bucket,
    Key:          key,
    Body:         buffer,
    ContentType:  mimetype,
    CacheControl: 'public, max-age=31536000',
  }));

  console.log(`[r2] upload ok → ${key}`);
  return key;
}

/**
 * Remove um objeto do R2 a partir de qualquer formato armazenado (key, URL
 * assinada ou pública). Best-effort — nunca lança; quem chama decide se loga.
 * Retorna true se a chamada ao R2 foi feita com sucesso (ou não havia nada
 * pra remover), false se falhou.
 */
async function deleteFromR2(stored) {
  if (!stored) return true;
  const key = extractKey(stored);
  if (!key) return true;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return false;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`[r2] delete ok → ${key}`);
    return true;
  } catch (err) {
    console.error('[r2] delete error:', err.message);
    return false;
  }
}

module.exports = { uploadToR2, uploadRaw, getPresignedUrl, getPublicUrl, extractKey, deleteFromR2, APP_PREFIX };
