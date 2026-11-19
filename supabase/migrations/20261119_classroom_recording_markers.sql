-- #874: the teacher taps "Mark" during a recorded lesson; each tap saves the
-- moment (seconds from the start of the lesson video) with an optional short
-- label. The Piano Studio portal shows them under the video on the family's
-- lesson page, and tapping one jumps there.
--
-- recording_key is the lesson video's file name on R2, "<studentId>_<startMs>.mp4"
-- (the last part of classroom_recordings.url and of the portal's lessons.video_url).
-- Written by the classroom's /api/recording/mark (service role); read by the
-- portal's server (service role). RLS on, no policies.
-- Applied to prod by hand on 2026-11-19 (migrations here are not auto-run).
create table if not exists public.classroom_recording_markers (
    id uuid primary key default gen_random_uuid(),
    recording_key text not null,
    student_id text not null,
    offset_seconds integer not null check (offset_seconds >= 0),
    label text check (label is null or char_length(label) <= 40),
    created_at timestamptz not null default now()
);
create index if not exists classroom_recording_markers_key_idx
    on public.classroom_recording_markers (recording_key);
alter table public.classroom_recording_markers enable row level security;
