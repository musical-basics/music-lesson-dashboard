-- Create table for storing user presets (e.g. text tool styles)
create table if not exists public.classroom_presets (
  id uuid default gen_random_uuid() primary key,
  user_id text not null, -- Stores 'teacher-1' or real UUID
  preset_type text not null, -- e.g. 'text_tool'
  data jsonb not null, -- Stores the array of presets: [{name: "Fingering", color: "red"...}]
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one row per preset type per user (so we update it, not duplicate it)
  unique(user_id, preset_type)
);

-- Enable RLS (Security)
alter table public.classroom_presets enable row level security;

-- Policy: Allow everyone to read/write (since we rely on app-level auth currently)
create policy "Allow all access to presets"
on public.classroom_presets for all
using (true)
with check (true);
