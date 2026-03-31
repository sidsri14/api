import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Decrypts a value encrypted by encrypt(). Falls back to plain text for
// backward compatibility with records created before encryption was enabled.
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  const [ivHex, tagHex, dataHex] = value.split(':');
  const iv = Buffer.from(ivHex!, 'hex');
  const tag = Buffer.from(tagHex!, 'hex');
  const data = Buffer.from(dataHex!, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Returns true if the value looks like an encrypted string (iv:tag:data hex triplet)
function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
