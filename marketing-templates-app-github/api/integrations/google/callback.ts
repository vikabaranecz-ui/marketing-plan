import { adminHeaders, encryptCredentials, requiredGoogleEnv, sendJson, verifyState } from '../../_lib/integrations';

interface OAuthState { userId: string; clientId: string; expiresAt: number }
export default async function handler(request: any, response: any) {
  const state = verifyState<OAuthState>(typeof request.query?.state === 'string' ? request.query.state : '');
  const code = typeof request.query?.code === 'string' ? request.query.code : null;
  const missing = [...requiredGoogleEnv(), ...(!process.env.INTEGRATION_ENCRYPTION_KEY ? ['INTEGRATION_ENCRYPTION_KEY'] : []), ...(!process.env.SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : [])];
  if (missing.length) return sendJson(response, { status: 'setup_required', missing }, 503);
  if (!state || !code) return sendJson(response, { error: 'Invalid or expired OAuth callback' }, 400);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!, grant_type: 'authorization_code' }) });
  if (!tokenResponse.ok) return sendJson(response, { error: 'Google token exchange failed' }, 502);
  const credentials = await tokenResponse.json();
  const rows = ['ga4', 'search_console'].map(provider => ({ user_id: state.userId, client_id: state.clientId, provider, status: 'setup_required', encrypted_credentials: encryptCredentials(credentials), updated_at: new Date().toISOString() }));
  const saved = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integration_connections?on_conflict=user_id,client_id,provider`, { method: 'POST', headers: { ...adminHeaders(), prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  if (!saved.ok) return sendJson(response, { error: 'Could not save the encrypted connection' }, 502);
  return response.redirect(302, '/?integration=google&status=property_required');
}
