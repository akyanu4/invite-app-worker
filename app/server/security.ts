import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new HttpError(500, `Server setting ${name} is missing. Add it in Vercel → Settings → Environment Variables.`);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function randomId(prefix: string, bytes = 9): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url')}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [, saltB64, hashB64] = stored.split('$');
  if (!saltB64 || !hashB64) return false;
  const want = Buffer.from(hashB64, 'base64');
  const got = scryptSync(password, Buffer.from(saltB64, 'base64'), want.length);
  return timingSafeEqual(want, got);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type TokenClaims = { sub: string; role: 'shop' | 'admin'; exp: number };

/** Small signed token (like a JWT): base64url(json).base64url(hmac). */
export function signToken(claims: Omit<TokenClaims, 'exp'>, days = 60): string {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + days * 86400_000 })).toString('base64url');
  const mac = createHmac('sha256', env('SESSION_SECRET')).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function readToken(req: Request): TokenClaims | null {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = createHmac('sha256', env('SESSION_SECRET')).update(body).digest('base64url');
  if (!safeEqual(want, mac)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenClaims;
    return claims.exp > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

/** Cloudinary signed-upload parameters for one card photo (no API secret leaves the server). */
export function cloudinaryUploadSignature(publicId: string) {
  const url = env('CLOUDINARY_URL');
  const m = url.match(/^cloudinary:\/\/(\d+):([^@]+)@(.+)$/);
  if (!m) throw new HttpError(500, 'CLOUDINARY_URL is not in the form cloudinary://key:secret@cloud');
  const [, apiKey, apiSecret, cloud] = m;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');
  return { cloud_name: cloud, api_key: apiKey, timestamp, public_id: publicId, signature };
}
