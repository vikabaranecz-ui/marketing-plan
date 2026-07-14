# Supabase connection

Connected Supabase project:

- Project: `vikabaranecz-ui's Project`
- Project ID: `xyvpresvfubmmfweyasf`
- Region: `eu-west-1`
- Status: `ACTIVE_HEALTHY`
- API URL: `https://xyvpresvfubmmfweyasf.supabase.co`
- Database host: `db.xyvpresvfubmmfweyasf.supabase.co`

Files in this folder:

- `project.json`: safe project connection metadata
- `database.types.ts`: generated TypeScript database types
- `schema.sql`: reproducible table, grants, and RLS definition

Cloud memory is implemented in the Vite/React app through the `public.app_states`
table. Each authenticated user owns one JSONB state row. Row Level Security limits
all reads and writes to `auth.uid() = user_id`, while the frontend uses only the
project's public publishable key.

The app automatically migrates existing browser data to Supabase after its first
successful sign-in. Anonymous sign-ins must be enabled under Authentication →
Providers for the zero-login experience used by the app.
