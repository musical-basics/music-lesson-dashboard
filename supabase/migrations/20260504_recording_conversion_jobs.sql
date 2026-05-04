-- Queue for server-side WebM -> MP4 conversion workers.
-- The browser uploads WebM segments only; a background worker converts them later.

create table if not exists public.classroom_recordings (
  id uuid primary key default gen_random_uuid(),
  student_id text,
  teacher_id text,
  filename text,
  url text not null,
  size_bytes bigint default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recording_conversion_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references public.classroom_recordings(id) on delete set null,
  source_key text not null,
  source_url text not null,
  target_key text not null,
  target_url text,
  student_id text,
  teacher_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recording_conversion_jobs_status_created
on public.recording_conversion_jobs(status, created_at);

alter table public.recording_conversion_jobs enable row level security;

drop policy if exists "Service role manages recording conversion jobs"
on public.recording_conversion_jobs;

create policy "Service role manages recording conversion jobs"
on public.recording_conversion_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
