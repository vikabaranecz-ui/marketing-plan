import { authenticatedUser, json, requiredGoogleEnv, signState } from '../../_lib/integrations.js';

export default async function handler(request: Request) {
  const missing = requiredGoogleEnv();
  if (missing.length) return json({ status: 'setup_required', missing, message: 'Configure Google OAuth environment variables in Vercel.' }, 503);
  const user = await authenticatedUser(request);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return json({ error: 'clientId is required' }, 400);
  const state = signState({ userId: user.id, clientId, expiresAt: Date.now() + 10 * 60_000 });
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!, response_type: 'code', access_type: 'offline', prompt: 'consent', state, scope: ['openid','email','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/webmasters.readonly'].join(' ') }).toString();
  return json({ status: 'ready', authorizationUrl: auth.toString() });
}
