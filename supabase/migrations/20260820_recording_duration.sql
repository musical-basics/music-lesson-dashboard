-- Recordings store size/duration metadata that LiveKit Egress cannot supply at
-- stop time: the file is still being written to R2 when stopEgress() returns,
-- so size_bytes was always inserted as 0. Both fields are now backfilled from
-- the object itself (HEAD for size, ffprobe for duration).
alter table public.classroom_recordings
  add column if not exists duration_seconds numeric;
