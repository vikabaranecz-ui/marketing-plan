# Team collaboration model

## Access rules

- Every plan is private by default and remains in the owner's `app_states` row.
- A plan becomes collaborative only after its owner selects **Share with team**.
- Shared plan content is stored in `shared_plans`; task progress, subtasks and task comments are synchronized for the whole team.
- `owner` and `editor` members can edit shared plans. `viewer` members have read-only access.
- Row Level Security checks team membership for every read and write. A signed-in outsider cannot discover teams, members or shared plans.
- Making a plan private deletes its team copy while the owner's private cloud state remains available.

## New user flow

1. A new person chooses **Create new account** on the password screen.
2. They enter an email and a password with at least eight characters.
3. Supabase sends an email confirmation. After confirmation, the user receives a clean private planner.
4. The team owner opens **Team & access** and adds the confirmed email as an `editor` or `viewer`.
5. The member sees only plans explicitly shared with that team.

Existing users can sign in with a password or request a magic link. Anonymous sessions are not used by the application.

## Supabase objects

- `teams` — team identity and owner.
- `team_members` — confirmed users and roles.
- `shared_plans` — team-visible plan snapshot with tasks, progress, subtasks and comments.
- `create_team`, `add_team_member_by_email`, `remove_team_member` — guarded RPC operations.
- Realtime publication for `shared_plans` — refreshes collaborators when a plan changes.
