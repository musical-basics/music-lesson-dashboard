"use client"
import { useState } from 'react'
import { LiveKitRoom, VideoConference, useTracks, ParticipantTile } from "@livekit/components-react"
import { Track } from "livekit-client"
import { MusicLibrary, Song } from '@/components/music-library'
import { HorizontalMusicContainer } from '@/components/horizontal-music-container'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings2, Disc, Square, Loader2 } from 'lucide-react'
import { supabase } from '@/supabase/client'
import { useRef } from 'react'

interface LiveSessionProps {
    token: string
    serverUrl: string
    studentId: string
    studentName: string
    onDisconnect: () => void
}

// Custom component that forces vertical video stacking
function VerticalVideoStack() {
    // Fetch all Camera and ScreenShare tracks
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    return (
        <div className="flex flex-col h-full w-full bg-black">
            {tracks.map((track) => (
                <div
                    key={track.participant.identity}
                    // flex-1 ensures they split the height equally (50/50 for 2 people)
                    className="flex-1 relative border-b border-zinc-800 last:border-b-0 overflow-hidden"
                >
                    <ParticipantTile
                        trackRef={track}
                        className="w-full h-full object-cover"
                    />
                </div>
            ))}
            {tracks.length === 0 && (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                    Waiting for video...
                </div>
            )}
        </div>
    );
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

    // --- RECORDING LOGIC ---
    const [isRecording, setIsRecording] = useState(false)
    const [uploadStatus, setUploadStatus] = useState("")
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const uploadToR2 = async (blob: Blob, filename: string) => {
        const response = await fetch('/api/upload-url', {
            method: 'POST',
            body: JSON.stringify({ filename, contentType: blob.type })
        })

        if (!response.ok) throw new Error("Failed to get upload URL")
        const { url } = await response.json()

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', url)
            xhr.setRequestHeader('Content-Type', blob.type)

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100)
                    setUploadStatus(`Uploading: ${percent}%`)
                }
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(true)
                } else {
                    reject(new Error("Upload failed"))
                }
            }
            xhr.onerror = () => reject(new Error("Network error during upload"))
            xhr.send(blob)
        })
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            })

            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' })
                const filename = `${studentId}_${Date.now()}.webm`

                setUploadStatus("Starting upload...")
                setIsRecording(false) // Ensure UI updates

                try {
                    await uploadToR2(blob, filename)

                    setUploadStatus("Saving to database...")
                    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${filename}`

                    const { error } = await supabase.from('classroom_recordings').insert({
                        student_id: studentId,
                        teacher_id: "teacher-1",
                        filename: `Lesson - ${new Date().toLocaleDateString()}`,
                        url: publicUrl,
                        size_bytes: blob.size
                    })

                    if (error) throw error

                    setUploadStatus("")
                    alert("✅ Recording saved! It is now available in the student dashboard.")

                } catch (e) {
                    console.error(e)
                    setUploadStatus("Error!")
                    alert("Upload failed. The video will be downloaded locally instead.")

                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename
                    a.click()
                }
            }

            mediaRecorderRef.current = recorder
            chunksRef.current = []
            recorder.start()
            setIsRecording(true)

            // Stop if user cancels screen share
            stream.getVideoTracks()[0].onended = () => {
                stopRecording()
            }

        } catch (err) {
            console.error("Error starting recording:", err)
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
            // Stop tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
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
                        {/* RECORDING CONTROLS */}
                        {uploadStatus ? (
                            <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {uploadStatus}
                            </div>
                        ) : (
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${isRecording
                                    ? "bg-red-500 text-white animate-pulse"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                                    }`}
                            >
                                {isRecording ? (
                                    <>
                                        <Square className="w-3 h-3 fill-current" /> Stop Rec
                                    </>
                                ) : (
                                    <>
                                        <Disc className="w-3 h-3" /> Record
                                    </>
                                )}
                            </button>
                        )}

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
                            activeTool="scroll"
                        />
                    </div>

                    {/* RIGHT: Video */}
                    <div className="w-[300px] bg-zinc-900 flex flex-col shrink-0 border-l border-zinc-800">
                        <div className="flex-1 relative">
                            {/* Use our custom stack instead of the default grid */}
                            <VerticalVideoStack />
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
