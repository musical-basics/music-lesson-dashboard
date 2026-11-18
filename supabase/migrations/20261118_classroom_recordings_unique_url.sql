-- One library row per recording file. The teacher's Stop and LiveKit's
-- egress_ended webhook can both save the same file; lib/recording-library.ts
-- treats a unique violation (23505) as "already saved".
-- Applied to prod by hand on 2026-11-18 (migrations here are not auto-run).
create unique index if not exists classroom_recordings_url_key
  on public.classroom_recordings (url);
