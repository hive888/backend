// utils/cryptoVault.js
'use strict';
const crypto = require('crypto');

// Read + validate key each time (no caching), so changes in env take effect after restart.
function ensureKey() {
  const base64Key = process.env.ENCRYPTION_KEY || '';
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('Invalid ENCRYPTION_KEY: must be 32 bytes base64.');
  }
  return key;
}

// AES-256-GCM with 12-byte IV (nonce). Stored format: [IV(12)] [TAG(16)] [CIPHERTEXT(...)]
exports.encryptToBuffer = (plaintext) => {
  // allow empty string '', but reject null/undefined
  if (plaintext == null) return null;
  const KEY = ensureKey();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]);
};

exports.decryptFromBuffer = (blob) => {
  if (!blob) return null;
  const KEY = ensureKey();

  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < 12 + 16) {
    throw new Error('Invalid payload: too short for IV+TAG.');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
};
