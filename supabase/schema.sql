create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_states_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.app_states enable row level security;

revoke all on table public.app_states from anon, authenticated;
grant select, insert, update, delete on table public.app_states to authenticated;

drop policy if exists "Users can read their app state" on public.app_states;
create policy "Users can read their app state"
on public.app_states for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their app state" on public.app_states;
create policy "Users can create their app state"
on public.app_states for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their app state" on public.app_states;
create policy "Users can update their app state"
on public.app_states for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their app state" on public.app_states;
create policy "Users can delete their app state"
on public.app_states for delete to authenticated
using ((select auth.uid()) = user_id);
