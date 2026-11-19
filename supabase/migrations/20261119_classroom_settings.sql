-- #950: settings the classroom reads at run time, shared with the Piano Studio
-- portal (same database). First one: livekit_fallback = true sends new
-- classroom connections to LiveKit Cloud instead of the studio's own server,
-- so a long outage is fixed with one tap from the portal's server-down email
-- (no env change, no redeploy). lib/livekit-target.ts reads it (30 s cache).
-- Service role only. Applied to prod by hand on 2026-11-19.
create table if not exists public.classroom_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text
);
alter table public.classroom_settings enable row level security;
insert into public.classroom_settings (key, value, updated_by)
values ('livekit_fallback', 'false'::jsonb, 'migration')
on conflict (key) do nothing;
