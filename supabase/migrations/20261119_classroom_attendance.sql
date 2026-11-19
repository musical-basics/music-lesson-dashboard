-- #795: who was in each lesson room, from our LiveKit server's participant
-- webhooks (app/api/livekit/webhook, lib/attendance.ts). One row per connection
-- (a reload or reconnect is a new row). The portal sums the time the teacher and
-- the student were in the room together and logs the lesson at 20+ minutes
-- (piano-studio-prototype lib/classroom-attendance.ts). Service role only.
-- Applied to prod by hand on 2026-11-19 (migrations here are not auto-run).
create table if not exists public.classroom_attendance (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  -- from the room name lesson-<student id>
  student_id text not null,
  participant_sid text not null unique,
  identity text not null,
  role text not null check (role in ('teacher', 'student')),
  joined_at timestamptz not null,
  -- null while connected
  left_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists classroom_attendance_student_joined_idx
  on public.classroom_attendance (student_id, joined_at desc);
create index if not exists classroom_attendance_open_idx
  on public.classroom_attendance (room_name) where left_at is null;
alter table public.classroom_attendance enable row level security;
