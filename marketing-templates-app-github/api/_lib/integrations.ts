import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const sendJson = (response: any, body: unknown, status = 200) => response.status(status).json(body);
export const requiredGoogleEnv = () => ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'INTEGRATION_STATE_SECRET'].filter(key => !process.env[key]);

const encode = (value: string) => Buffer.from(value).toString('base64url');
export const signState = (payload: object) => {
  const data = encode(JSON.stringify(payload));
  const signature = createHmac('sha256', process.env.INTEGRATION_STATE_SECRET!).update(data).digest('base64url');
  return `${data}.${signature}`;
};
export const verifyState = <T>(state: string): T | null => {
  const [data, signature] = state.split('.');
  if (!data || !signature || !process.env.INTEGRATION_STATE_SECRET) return null;
  const expected = createHmac('sha256', process.env.INTEGRATION_STATE_SECRET).update(data).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const value = JSON.parse(Buffer.from(data, 'base64url').toString()) as T & { expiresAt?: number };
  return value.expiresAt && value.expiresAt < Date.now() ? null : value;
};

export const authenticatedUser = async (request: any) => {
  const authorization = typeof request.headers?.get === 'function' ? request.headers.get('authorization') : request.headers?.authorization;
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } });
  return response.ok ? await response.json() as { id: string } : null;
};

export const adminHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`, 'content-type': 'application/json' });
export const encryptCredentials = (value: unknown) => {
  const key = createHash('sha256').update(process.env.INTEGRATION_ENCRYPTION_KEY || '').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
};
