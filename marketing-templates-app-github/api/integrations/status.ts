import { authenticatedUser, adminHeaders, requiredGoogleEnv, sendJson } from '../_lib/integrations';

export default async function handler(request: any, response: any) {
  const user = await authenticatedUser(request);
  if (!user) return sendJson(response, { error: 'Unauthorized' }, 401);
  const clientId = typeof request.query?.clientId === 'string' ? request.query.clientId : null;
  if (!clientId) return sendJson(response, { error: 'clientId is required' }, 400);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return sendJson(response, { error: 'Server storage is not configured' }, 503);
  const storageResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integration_connections?user_id=eq.${encodeURIComponent(user.id)}&client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,provider,status,external_account_id,external_account_name,property_id,property_url,last_synced_at,last_error,created_at,updated_at`, { headers: adminHeaders() });
  if (!storageResponse.ok) return sendJson(response, { error: 'Unable to read integration status' }, 502);
  return sendJson(response, { connections: await storageResponse.json(), google: requiredGoogleEnv().length ? 'setup_required' : 'available', unavailableProviders: ['instagram','facebook','tiktok','linkedin','google_ads','meta_ads'] });
}
