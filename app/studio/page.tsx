"use client"
import { useState } from 'react'
import { MusicLibrary, Song } from '@/components/music-library'
import { HorizontalMusicContainer } from '@/components/horizontal-music-container'

export default function StudioPage() {
    const [currentSong, setCurrentSong] = useState<Song>({
        id: 'la-campanella',
        title: 'La Campanella Remix',
        url: '/xmls/La Campanella Remix v8.musicxml'
    })

    return (
        <div className="flex bg-zinc-950 h-[calc(100vh-64px)] overflow-hidden">
            {/* 1. Sidebar */}
            <MusicLibrary
                currentSongId={currentSong.id}
                onSelectSong={setCurrentSong}
            />

            {/* 2. Main Stage */}
            <div className="flex-1 relative border-l border-zinc-800">
                <HorizontalMusicContainer
                    key={currentSong.id} // Key prop forces a full re-mount when song changes!
                    xmlUrl={currentSong.url}
                    songId={currentSong.id}
                />
            </div>
        </div>
    )
}
