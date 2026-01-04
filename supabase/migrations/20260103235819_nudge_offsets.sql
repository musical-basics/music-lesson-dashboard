-- Create nudge_offsets table for storing post-render SVG positioning
CREATE TABLE IF NOT EXISTS nudge_offsets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    element_selector TEXT NOT NULL,
    offset_x FLOAT DEFAULT 0,
    offset_y FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(song_id, element_selector)
);

-- Index for fast lookups by song
CREATE INDEX IF NOT EXISTS idx_nudge_offsets_song_id ON nudge_offsets(song_id);
