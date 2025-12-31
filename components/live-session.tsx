"use client"
import { useState } from 'react'
import { LiveKitRoom, VideoConference, useTracks, LayoutContextProvider } from "@livekit/components-react"
import { Track } from "livekit-client"
import { MusicLibrary, Song } from '@/components/music-library'
import { HorizontalMusicContainer } from '@/components/horizontal-music-container'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'

interface LiveSessionProps {
    token: string
    serverUrl: string
    onDisconnect: () => void
}

export function LiveSession({ token, serverUrl, onDisconnect }: LiveSessionProps) {
    const [currentSong, setCurrentSong] = useState<Song>({
        id: 'la-campanella',
        title: 'La Campanella Remix',
        url: '/xmls/La Campanella Remix v8.musicxml'
    })

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            onDisconnected={onDisconnect}
            data-lk-theme="default"
            style={{ height: '100%' }}
        >
            <div className="flex bg-zinc-950 h-screen overflow-hidden">

                {/* 1. LEFT: Library */}
                <MusicLibrary
                    currentSongId={currentSong.id}
                    onSelectSong={setCurrentSong}
                />

                {/* 2. CENTER: Sheet Music */}
                <div className="flex-1 relative border-l border-r border-zinc-800 flex flex-col min-w-0">
                    <HorizontalMusicContainer
                        key={currentSong.id}
                        xmlUrl={currentSong.url}
                        songId={currentSong.id}
                    />
                </div>

                {/* 3. RIGHT: Real Video Call */}
                <div className="w-[300px] bg-zinc-900 flex flex-col shrink-0 border-l border-zinc-800">
                    <div className="p-3 border-b border-zinc-800 font-semibold text-zinc-400 text-xs uppercase tracking-wider flex justify-between items-center">
                        <span>Live Session</span>
                        <button
                            onClick={onDisconnect}
                            className="text-red-400 hover:text-red-300 text-[10px] bg-red-900/20 px-2 py-1 rounded"
                        >
                            End Call
                        </button>
                    </div>

                    {/* The Video Grid */}
                    <div className="flex-1 relative">
                        {/* LiveKit's VideoConference component automatically handles:
                       - Showing the remote student (large)
                       - Showing you (small PiP)
                       - Grid layout if multiple people join
                    */}
                        <VideoConference />
                    </div>

                    {/* Lesson Notes / Chat Area */}
                    <div className="h-1/3 border-t border-zinc-800 p-4">
                        <div className="h-full border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 text-xs">
                            Shared Notes (Coming Soon)
                        </div>
                    </div>
                </div>

            </div>
        </LiveKitRoom>
    )
}
