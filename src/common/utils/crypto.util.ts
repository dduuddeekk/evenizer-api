import * as crypto from 'crypto';

const KEY_ENV = process.env.LOCATION_ENCRYPTION_KEY || '';

function getKey(): Buffer {
  if (!KEY_ENV) throw new Error('Missing LOCATION_ENCRYPTION_KEY env var');

  // Support hex or base64 or raw
  if (/^[0-9a-fA-F]+$/.test(KEY_ENV) && KEY_ENV.length === 64) {
    return Buffer.from(KEY_ENV, 'hex');
  }

  try {
    const buf = Buffer.from(KEY_ENV, 'base64');
    if (buf.length === 32) return buf;
  } catch {}

  const buf = Buffer.from(KEY_ENV);
  if (buf.length !== 32) throw new Error('LOCATION_ENCRYPTION_KEY must be 32 bytes (base64 or hex)');
  return buf;
}

export function encryptLocation(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptLocation(payload: string): string {
  const key = getKey();
  const data = Buffer.from(payload, 'base64');
  if (data.length < 12 + 16) throw new Error('Invalid encrypted payload');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export default { encryptLocation, decryptLocation };
