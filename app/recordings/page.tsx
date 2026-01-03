"use client"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Video, Play, Calendar, Clock, User, Download, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Recording = {
    id: string
    student_id: string
    teacher_id: string
    filename: string
    url: string
    size_bytes: number
    created_at: string
}

export default function RecordingsPage() {
    const [recordings, setRecordings] = useState<Recording[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedVideo, setSelectedVideo] = useState<Recording | null>(null)

    const loadRecordings = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/recordings")
            const data = await res.json()
            if (Array.isArray(data)) {
                setRecordings(data)
            }
        } catch (error) {
            console.error("Failed to load recordings:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadRecordings()
    }, [])

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes"
        const k = 1024
        const sizes = ["Bytes", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">
            <DashboardSidebar />

            <div className="flex-1 p-8 overflow-auto h-screen">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Video className="w-8 h-8 text-indigo-400" />
                                Lesson Recordings
                            </h1>
                            <p className="text-zinc-400 mt-1">
                                View and manage recorded lesson sessions.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={loadRecordings}
                            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Video Player Modal */}
                    {selectedVideo && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full overflow-hidden">
                                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                                    <h3 className="font-semibold text-lg">{selectedVideo.filename}</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedVideo(null)}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        Close
                                    </Button>
                                </div>
                                <div className="aspect-video bg-black">
                                    <video
                                        src={selectedVideo.url}
                                        controls
                                        autoPlay
                                        className="w-full h-full"
                                    />
                                </div>
                                <div className="p-4 flex items-center justify-between text-sm text-zinc-400">
                                    <span>Recorded: {formatDate(selectedVideo.created_at)}</span>
                                    <a
                                        href={selectedVideo.url}
                                        download
                                        className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300"
                                    >
                                        <Download className="w-4 h-4" /> Download
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recordings Grid */}
                    {isLoading ? (
                        <div className="py-20 text-center text-zinc-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" />
                            Loading recordings...
                        </div>
                    ) : recordings.length === 0 ? (
                        <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
                            <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">No recordings yet</p>
                            <p className="text-sm mt-1">
                                Record a lesson session to see it here.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recordings.map((recording) => (
                                <div
                                    key={recording.id}
                                    className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-900/10"
                                    onClick={() => setSelectedVideo(recording)}
                                >
                                    {/* Thumbnail placeholder */}
                                    <div className="aspect-video bg-zinc-800 flex items-center justify-center relative">
                                        <Play className="w-12 h-12 text-zinc-600 group-hover:text-indigo-400 group-hover:scale-110 transition-all" />
                                        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-zinc-300">
                                            {formatBytes(recording.size_bytes)}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4 space-y-2">
                                        <h3 className="font-medium text-zinc-200 group-hover:text-white truncate">
                                            {recording.filename}
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {recording.student_id}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(recording.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
