-- #792: the teacher's piano camera is also saved on its own (a LiveKit Track
-- Egress, video only) next to the two-camera lesson video. Both are library
-- rows; `kind` tells them apart and the piano file points at its lesson video.
-- Only kind 'lesson' rows go on a lesson in the portal (attach, auto-log,
-- Dropbox copies). Existing rows are all 'lesson'.
-- Applied to prod by hand on 2026-11-19 (migrations here are not auto-run).
alter table public.classroom_recordings
  add column if not exists kind text not null default 'lesson',
  add column if not exists lesson_recording_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'classroom_recordings_kind_check'
      and conrelid = 'public.classroom_recordings'::regclass
  ) then
    alter table public.classroom_recordings
      add constraint classroom_recordings_kind_check check (kind in ('lesson', 'piano'));
  end if;
end $$;

create index if not exists classroom_recordings_lesson_recording_url_idx
  on public.classroom_recordings (lesson_recording_url)
  where lesson_recording_url is not null;
