"use client"
import { useState } from 'react'
import { LiveKitRoom, VideoConference } from "@livekit/components-react"
import { MusicLibrary, Song } from '@/components/music-library'
import { HorizontalMusicContainer } from '@/components/horizontal-music-container'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings2 } from 'lucide-react'

interface LiveSessionProps {
    token: string
    serverUrl: string
    studentId: string
    studentName: string
    onDisconnect: () => void
}

export function LiveSession({ token, serverUrl, studentId, studentName, onDisconnect }: LiveSessionProps) {
    const [currentSong, setCurrentSong] = useState<Song>({
        id: 'la-campanella',
        title: 'La Campanella Remix',
        url: '/xmls/La Campanella Remix v8.musicxml'
    })

    // Helper to "hard reload" the window on disconnect for a clean slate
    const handleEndLesson = () => {
        if (confirm("End current lesson?")) {
            onDisconnect()
        }
    }

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
            <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">

                {/* 1. SESSION CONTROL BAR */}
                <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Live Indicator */}
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-zinc-800">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-zinc-300 text-xs font-mono font-medium tracking-wide">
                                LIVE SESSION
                            </span>
                        </div>

                        <div className="h-4 w-px bg-zinc-700" />

                        {/* Student Context */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-500">Student:</span>
                            <span className="text-white font-medium">{studentName}</span>
                            <span className="text-zinc-600 text-xs font-mono">({studentId})</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Settings Placeholder */}
                        <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                            <Settings2 className="w-4 h-4" />
                        </button>

                        {/* END LESSON */}
                        <button
                            onClick={handleEndLesson}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all"
                        >
                            <PhoneOff className="w-3 h-3" /> End Lesson
                        </button>
                    </div>
                </div>

                {/* 2. MAIN WORKSPACE (Library | Music | Video) */}
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT: Library */}
                    <MusicLibrary
                        currentSongId={currentSong.id}
                        onSelectSong={setCurrentSong}
                    />

                    {/* CENTER: Sheet Music */}
                    <div className="flex-1 relative border-l border-r border-zinc-800 flex flex-col min-w-0">
                        <HorizontalMusicContainer
                            key={currentSong.id} // Re-mounts on song change
                            xmlUrl={currentSong.url}
                            songId={currentSong.id}
                            studentId={studentId} // Pass down specific student context
                        />
                    </div>

                    {/* RIGHT: Video */}
                    <div className="w-[300px] bg-zinc-900 flex flex-col shrink-0 border-l border-zinc-800">
                        <div className="flex-1 relative">
                            <VideoConference />
                        </div>
                        {/* Chat Placeholder */}
                        <div className="h-1/3 border-t border-zinc-800 p-4">
                            <textarea
                                className="w-full h-full bg-black/20 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none"
                                placeholder="Shared Lesson Notes..."
                            />
                        </div>
                    </div>
                </div>

            </div>
        </LiveKitRoom>
    )
}
