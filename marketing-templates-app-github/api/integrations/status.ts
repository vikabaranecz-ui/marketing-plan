import { authenticatedUser, adminHeaders, json, requiredGoogleEnv } from '../_lib/integrations.js';

export default async function handler(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const clientId = new URL(request.url).searchParams.get('clientId');
  if (!clientId) return json({ error: 'clientId is required' }, 400);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server storage is not configured' }, 503);
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integration_connections?user_id=eq.${encodeURIComponent(user.id)}&client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,provider,status,external_account_id,external_account_name,property_id,property_url,last_synced_at,last_error,created_at,updated_at`, { headers: adminHeaders() });
  if (!response.ok) return json({ error: 'Unable to read integration status' }, 502);
  return json({ connections: await response.json(), google: requiredGoogleEnv().length ? 'setup_required' : 'available', unavailableProviders: ['instagram','facebook','tiktok','linkedin','google_ads','meta_ads'] });
}
