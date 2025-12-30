"use client"
import { useState } from 'react'
import { MusicLibrary, Song } from '@/components/music-library'
import { HorizontalMusicContainer } from '@/components/horizontal-music-container'
import { Mic, MicOff, Video, VideoOff } from 'lucide-react'

export default function StudioPage() {
    const [currentSong, setCurrentSong] = useState<Song>({
        id: 'la-campanella',
        title: 'La Campanella Remix',
        url: '/xmls/La Campanella Remix v8.musicxml'
    })

    return (
        <div className="flex bg-zinc-950 h-[calc(100vh-64px)] overflow-hidden">

            {/* 1. LEFT SIDEBAR: Library (Fixed 250px) */}
            <MusicLibrary
                currentSongId={currentSong.id}
                onSelectSong={setCurrentSong}
            />

            {/* 2. CENTER STAGE: Sheet Music (Fills remaining space) */}
            <div className="flex-1 relative border-l border-r border-zinc-800 flex flex-col min-w-0">
                <HorizontalMusicContainer
                    key={currentSong.id} // Forces clean re-mount on song change
                    xmlUrl={currentSong.url}
                    songId={currentSong.id}
                />
            </div>

            {/* 3. RIGHT SIDEBAR: Video Call (Fixed 300px) */}
            <div className="w-[300px] bg-zinc-900 flex flex-col shrink-0">
                <div className="p-4 border-b border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                        Live Session
                    </h2>

                    {/* Student Video Feed */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-lg border border-zinc-700">
                        {/* Placeholder for now - LiveKit Track goes here later */}
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
                            Waiting for camera...
                        </div>

                        {/* Quick Controls Overlay */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                            <button className="p-2 bg-red-500/90 rounded-full text-white hover:scale-105 transition-transform">
                                <MicOff className="w-4 h-4" />
                            </button>
                            <button className="p-2 bg-zinc-800/80 rounded-full text-white hover:bg-zinc-700 transition-transform">
                                <Video className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-zinc-500">
                            <span>Connection</span>
                            <span className="text-green-500">Excellent</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                            <span>Mic Input</span>
                            <span className="text-zinc-300">MacBook Pro</span>
                        </div>
                    </div>
                </div>

                {/* Chat or Notes could go here later */}
                <div className="flex-1 bg-zinc-900/50 p-4">
                    <div className="h-full border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 text-xs">
                        Lesson Notes Area
                    </div>
                </div>
            </div>

        </div>
    )
}
