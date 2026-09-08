# Analytics integrations

Google connections are server-side only. Until the following Vercel variables exist, the UI/API must display **Setup required**:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI=https://marketing-plan-olive.vercel.app/api/integrations/google/callback`
- `INTEGRATION_STATE_SECRET` (32+ random bytes)
- `INTEGRATION_ENCRYPTION_KEY` (32+ random bytes; encrypts OAuth credentials at rest)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server functions only; never `VITE_*`)

Enable Google Analytics Data API and Search Console API in Google Cloud. Configure the redirect URI above and request `analytics.readonly` and `webmasters.readonly` scopes. Apply the Supabase migration before enabling OAuth. Social providers remain **Not available yet** until their official applications and review credentials exist.
