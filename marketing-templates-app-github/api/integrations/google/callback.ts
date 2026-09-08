import { adminHeaders, encryptCredentials, json, requiredGoogleEnv, verifyState } from '../../_lib/integrations.js';

interface OAuthState { userId: string; clientId: string; expiresAt: number }
export default async function handler(request: Request) {
  const url = new URL(request.url);
  const state = verifyState<OAuthState>(url.searchParams.get('state') || '');
  const code = url.searchParams.get('code');
  const missing = [...requiredGoogleEnv(), ...(!process.env.INTEGRATION_ENCRYPTION_KEY ? ['INTEGRATION_ENCRYPTION_KEY'] : []), ...(!process.env.SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : [])];
  if (missing.length) return json({ status: 'setup_required', missing }, 503);
  if (!state || !code) return json({ error: 'Invalid or expired OAuth callback' }, 400);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!, grant_type: 'authorization_code' }) });
  if (!tokenResponse.ok) return json({ error: 'Google token exchange failed' }, 502);
  const credentials = await tokenResponse.json();
  const rows = ['ga4', 'search_console'].map(provider => ({ user_id: state.userId, client_id: state.clientId, provider, status: 'setup_required', encrypted_credentials: encryptCredentials(credentials), updated_at: new Date().toISOString() }));
  const saved = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integration_connections?on_conflict=user_id,client_id,provider`, { method: 'POST', headers: { ...adminHeaders(), prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  if (!saved.ok) return json({ error: 'Could not save the encrypted connection' }, 502);
  return Response.redirect(`${url.origin}/?integration=google&status=property_required`, 302);
}
