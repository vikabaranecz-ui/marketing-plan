import { authenticatedUser, requiredGoogleEnv, sendJson, signState } from '../../_lib/integrations.js';

export default async function handler(request: any, response: any) {
  const missing = requiredGoogleEnv();
  if (missing.length) return sendJson(response, { status: 'setup_required', missing, message: 'Configure Google OAuth environment variables in Vercel.' }, 503);
  const user = await authenticatedUser(request);
  if (!user) return sendJson(response, { error: 'Unauthorized' }, 401);
  const clientId = typeof request.query?.clientId === 'string' ? request.query.clientId : null;
  if (!clientId) return sendJson(response, { error: 'clientId is required' }, 400);
  const state = signState({ userId: user.id, clientId, expiresAt: Date.now() + 10 * 60_000 });
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!, response_type: 'code', access_type: 'offline', prompt: 'consent', state, scope: ['openid','email','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/webmasters.readonly'].join(' ') }).toString();
  return sendJson(response, { status: 'ready', authorizationUrl: auth.toString() });
}
