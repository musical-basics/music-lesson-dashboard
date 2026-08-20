"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import {
    Video,
    Play,
    Calendar,
    User,
    Download,
    Trash2,
    RefreshCw,
    Search,
    X,
    AlertTriangle,
    Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Recording = {
    id: string
    student_id: string
    student_name?: string
    teacher_id: string
    filename: string
    url: string
    size_bytes: number
    duration_seconds?: number | null
    created_at: string
}

// Metadata the browser can read straight off the file, so the grid shows real
// numbers even before the backfill script has run against the row.
type Probed = { duration: number; width: number; height: number; poster?: string }

const formatBytes = (bytes: number) => {
    if (!bytes) return null
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const formatDuration = (seconds?: number | null) => {
    if (seconds == null || !isFinite(seconds) || seconds <= 0) return null
    // Round to whole seconds first — rounding the remainder alone renders
    // 2159.7s as "35:60" instead of "36:00".
    const total = Math.round(seconds)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${m}:${String(s).padStart(2, "0")}`
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })

/**
 * Pulls duration + a poster frame from the video without downloading it all:
 * metadata preload gives dimensions/duration, then a single seek renders one
 * frame to a canvas. Lesson MP4s are ~800MB, so this only ever runs on the
 * small metadata prefix plus one keyframe.
 */
function useProbe(recordings: Recording[]) {
    const [probed, setProbed] = useState<Record<string, Probed | "failed">>({})
    const started = useRef<Set<string>>(new Set())

    useEffect(() => {
        let cancelled = false

        const probeOne = (rec: Recording) =>
            new Promise<void>((resolve) => {
                const video = document.createElement("video")
                video.preload = "metadata"
                video.muted = true
                video.crossOrigin = "anonymous"
                video.src = rec.url

                let settled = false
                const finish = (value: Probed | "failed") => {
                    if (settled) return
                    settled = true
                    clearTimeout(timer)
                    if (!cancelled) setProbed((p) => ({ ...p, [rec.id]: value }))
                    video.removeAttribute("src")
                    video.load()
                    resolve()
                }

                const timer = setTimeout(() => finish("failed"), 20000)

                video.onloadedmetadata = () => {
                    const meta: Probed = {
                        duration: video.duration,
                        width: video.videoWidth,
                        height: video.videoHeight,
                    }
                    // Seek a little way in — frame 0 of a lesson is often a
                    // blank/black frame before cameras publish.
                    const target = Math.min(
                        isFinite(video.duration) ? video.duration * 0.25 : 5,
                        30
                    )
                    video.onseeked = () => {
                        try {
                            const canvas = document.createElement("canvas")
                            const scale = 320 / (video.videoWidth || 320)
                            canvas.width = 320
                            canvas.height = Math.round((video.videoHeight || 180) * scale)
                            const ctx = canvas.getContext("2d")
                            if (ctx) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                                meta.poster = canvas.toDataURL("image/jpeg", 0.6)
                            }
                        } catch {
                            // Tainted canvas (no CORS header) — keep duration, skip poster.
                        }
                        finish(meta)
                    }
                    video.onerror = () => finish(meta)
                    try {
                        video.currentTime = target
                    } catch {
                        finish(meta)
                    }
                }
                video.onerror = () => finish("failed")
            })

        // Probe a couple at a time so a page of recordings doesn't open 14
        // simultaneous range requests.
        const queue = recordings.filter((r) => r.url && !started.current.has(r.id))
        queue.forEach((r) => started.current.add(r.id))

        const worker = async () => {
            while (queue.length && !cancelled) {
                const next = queue.shift()
                if (next) await probeOne(next)
            }
        }
        void Promise.all([worker(), worker()])

        return () => {
            cancelled = true
        }
    }, [recordings])

    return probed
}

export default function RecordingsPage() {
    const [recordings, setRecordings] = useState<Recording[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedVideo, setSelectedVideo] = useState<Recording | null>(null)
    const [search, setSearch] = useState("")
    const [studentFilter, setStudentFilter] = useState<string>("all")
    const [confirmDelete, setConfirmDelete] = useState<Recording | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const loadRecordings = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/recordings")
            const data = await res.json()
            if (Array.isArray(data)) setRecordings(data)
        } catch (error) {
            console.error("Failed to load recordings:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadRecordings()
    }, [])

    const probed = useProbe(recordings)

    // Esc closes the player.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedVideo(null)
                setConfirmDelete(null)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    const students = useMemo(() => {
        const map = new Map<string, string>()
        for (const r of recordings) {
            if (r.student_id) map.set(r.student_id, r.student_name || r.student_id)
        }
        return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
            a.name.localeCompare(b.name)
        )
    }, [recordings])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return recordings.filter((r) => {
            if (studentFilter !== "all" && r.student_id !== studentFilter) return false
            if (!q) return true
            return (
                r.filename.toLowerCase().includes(q) ||
                (r.student_name || "").toLowerCase().includes(q) ||
                formatDate(r.created_at).toLowerCase().includes(q)
            )
        })
    }, [recordings, search, studentFilter])

    const durationOf = (rec: Recording) => {
        const p = probed[rec.id]
        if (p && p !== "failed" && isFinite(p.duration)) return p.duration
        return rec.duration_seconds ?? null
    }

    const handleDelete = async (rec: Recording) => {
        setDeletingId(rec.id)
        try {
            const res = await fetch(`/api/recordings?id=${rec.id}`, { method: "DELETE" })
            if (res.ok) {
                setRecordings((prev) => prev.filter((r) => r.id !== rec.id))
                setConfirmDelete(null)
                if (selectedVideo?.id === rec.id) setSelectedVideo(null)
            } else {
                console.error("Delete failed", await res.text())
            }
        } catch (e) {
            console.error("Delete failed", e)
        } finally {
            setDeletingId(null)
        }
    }

    const totalSize = visible.reduce((sum, r) => sum + (r.size_bytes || 0), 0)

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">
            <DashboardSidebar />

            <div className="flex-1 p-4 md:p-8 overflow-auto h-screen">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Video className="w-8 h-8 text-indigo-400" />
                                Lesson Recordings
                            </h1>
                            <p className="text-zinc-400 mt-1">
                                {isLoading
                                    ? "Loading…"
                                    : `${visible.length} recording${visible.length === 1 ? "" : "s"}${
                                          totalSize ? ` · ${formatBytes(totalSize)}` : ""
                                      }`}
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

                    {/* Controls */}
                    {recordings.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by lesson, student, or date…"
                                    className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <select
                                value={studentFilter}
                                onChange={(e) => setStudentFilter(e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                                <option value="all">All students</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Video player */}
                    {selectedVideo && (
                        <div
                            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setSelectedVideo(null)}
                        >
                            <div
                                className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-lg truncate">
                                            {selectedVideo.filename}
                                        </h3>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {selectedVideo.student_name} ·{" "}
                                            {formatDate(selectedVideo.created_at)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedVideo(null)}
                                        className="text-zinc-400 hover:text-white shrink-0"
                                    >
                                        <X className="w-4 h-4 mr-1" /> Close
                                    </Button>
                                </div>
                                <div className="aspect-video bg-black">
                                    <video
                                        key={selectedVideo.id}
                                        src={selectedVideo.url}
                                        controls
                                        autoPlay
                                        playsInline
                                        className="w-full h-full"
                                    />
                                </div>
                                <div className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
                                    <span className="flex items-center gap-3">
                                        {formatDuration(durationOf(selectedVideo)) && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {formatDuration(durationOf(selectedVideo))}
                                            </span>
                                        )}
                                        {formatBytes(selectedVideo.size_bytes) && (
                                            <span>{formatBytes(selectedVideo.size_bytes)}</span>
                                        )}
                                    </span>
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

                    {/* Delete confirmation */}
                    {confirmDelete && (
                        <div
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                            onClick={() => setConfirmDelete(null)}
                        >
                            <div
                                className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="font-semibold">Remove this recording?</h3>
                                        <p className="text-sm text-zinc-400 mt-1">
                                            “{confirmDelete.filename}” will be removed from your
                                            library. The video file itself stays in storage.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setConfirmDelete(null)}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => handleDelete(confirmDelete)}
                                        disabled={deletingId === confirmDelete.id}
                                        className="bg-red-600 hover:bg-red-500 text-white"
                                    >
                                        {deletingId === confirmDelete.id ? "Removing…" : "Remove"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Grid */}
                    {isLoading ? (
                        <div className="py-20 text-center text-zinc-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" />
                            Loading recordings…
                        </div>
                    ) : recordings.length === 0 ? (
                        <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
                            <Video className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">No recordings yet</p>
                            <p className="text-sm mt-1">Record a lesson session to see it here.</p>
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
                            <Search className="w-10 h-10 mx-auto mb-4 opacity-20" />
                            <p>No recordings match your filters.</p>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearch("")
                                    setStudentFilter("all")
                                }}
                                className="mt-2 text-indigo-400 hover:text-indigo-300"
                            >
                                Clear filters
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visible.map((recording) => {
                                const p = probed[recording.id]
                                const broken = p === "failed"
                                const duration = durationOf(recording)
                                const poster = p && p !== "failed" ? p.poster : undefined

                                return (
                                    <div
                                        key={recording.id}
                                        className={`group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all ${
                                            broken
                                                ? "opacity-60"
                                                : "cursor-pointer hover:border-zinc-700 hover:shadow-lg hover:shadow-indigo-900/10"
                                        }`}
                                        onClick={() => !broken && setSelectedVideo(recording)}
                                    >
                                        {/* Thumbnail */}
                                        <div className="aspect-video bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                                            {poster ? (
                                                <img
                                                    src={poster}
                                                    alt=""
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                />
                                            ) : null}
                                            {broken ? (
                                                <div className="relative text-center px-3">
                                                    <AlertTriangle className="w-8 h-8 text-amber-500/70 mx-auto mb-1" />
                                                    <span className="text-[11px] text-amber-500/80">
                                                        Unplayable file
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="relative z-10 rounded-full bg-black/50 p-3 backdrop-blur-sm transition-transform group-hover:scale-110">
                                                    <Play className="w-7 h-7 text-white fill-white" />
                                                </div>
                                            )}
                                            {duration && !broken && (
                                                <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[11px] font-medium text-zinc-100 z-10">
                                                    {formatDuration(duration)}
                                                </div>
                                            )}
                                            {formatBytes(recording.size_bytes) && (
                                                <div className="absolute bottom-2 left-2 bg-black/70 px-1.5 py-0.5 rounded text-[11px] text-zinc-300 z-10">
                                                    {formatBytes(recording.size_bytes)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="p-4 space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="font-medium text-zinc-200 group-hover:text-white truncate">
                                                    {recording.filename}
                                                </h3>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setConfirmDelete(recording)
                                                    }}
                                                    className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 p-1 -m-1"
                                                    aria-label="Remove recording"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                <span className="flex items-center gap-1 truncate">
                                                    <User className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">
                                                        {recording.student_name}
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1 shrink-0">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(
                                                        recording.created_at
                                                    ).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
