-- Run this in your Supabase SQL Editor

create table annotations (
  id uuid default gen_random_uuid() primary key,
  student_id text not null,
  song_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one record per student+song combo
  unique(student_id, song_id)
);

-- Enable Row Level Security (Optional: Turn off for now if you want quick prototyping)
alter table annotations enable row level security;

-- Allow anyone to read/write (since we handle security via our custom API route)
create policy "Public Access" on annotations for all using (true);
