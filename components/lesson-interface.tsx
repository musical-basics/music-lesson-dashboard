"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Circle,
  Music,
  MessageSquare,
  LayoutGrid,
  Maximize2,
  PictureInPicture2,
  Pencil,
  Type,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Settings2,
  Plus,
  Bold,
  Italic,
  Underline,
  MousePointer2
} from "lucide-react"
import { VideoConference, useTracks, ParticipantTile } from "@livekit/components-react"
import { Track } from "livekit-client"
import { useIsMobile } from "@/hooks/use-mobile"
import { HorizontalMusicContainer, HorizontalMusicContainerHandle } from "@/components/horizontal-music-container"
import { PieceSelector } from "@/components/piece-selector"
import { Piece } from "@/types/piece"
import { useRoomSync, ActivePiece } from "@/hooks/use-room-sync"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { supabase } from "@/supabase/client"

// Define Preset Type
type TextPreset = {
  id: string
  name: string
  fontSize: number
  color: string
}

const DEFAULT_PRESETS: TextPreset[] = [
  { id: 'p1', name: 'Fingerings', fontSize: 16, color: '#ef4444' }, // Red small
  { id: 'p2', name: 'Note Names', fontSize: 20, color: '#3b82f6' }, // Blue medium
  { id: 'p3', name: 'Teacher Note', fontSize: 28, color: '#f59e0b' }, // Orange large
]

// Custom component that forces vertical video stacking
function VerticalVideoStack() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex flex-col h-full w-full bg-black rounded-lg overflow-hidden">
      {tracks.map((track) => (
        <div
          key={track.participant.identity}
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

type ViewMode = "sheet-music" | "dual-widescreen" | "picture-in-picture"
type AnnotationTool = "pen" | "highlighter" | "text" | "eraser" | "select" | null

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: "pen" | "highlighter"
}

interface TextAnnotation {
  id: string
  x: number
  y: number
  text: string
  color: string
}

interface SavedAnnotations {
  strokes: Stroke[]
  textAnnotations: TextAnnotation[]
  savedAt: string
  sheetMusicId?: string
}

interface LessonInterfaceProps {
  studentId?: string
}

export function LessonInterface({ studentId }: LessonInterfaceProps) {
  // Get the Role from URL
  const searchParams = useSearchParams()
  const role = searchParams.get('role')
  const isStudent = role === 'student'

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isMusicMode, setIsMusicMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("sheet-music")
  const [pipPosition, setPipPosition] = useState<"left" | "right">("right")

  // Room Sync: Teacher broadcasts, Student receives
  const { activePiece, setRoomPiece, isLoading: isRoomLoading } = useRoomSync(
    studentId || "student-1",
    isStudent ? 'student' : 'teacher'
  )

  const [activeTool, setActiveTool] = useState<AnnotationTool>(null)
  const [penColor, setPenColor] = useState("#ef4444")
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [history, setHistory] = useState<{ strokes: Stroke[]; texts: TextAnnotation[] }[]>([])
  const [isAddingText, setIsAddingText] = useState(false)
  const [pendingTextPosition, setPendingTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [isSaved, setIsSaved] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const musicContainerRef = useRef<HorizontalMusicContainerHandle>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const colors = ["#ef4444", "#8b5cf6", "#22c55e", "#3b82f6", "#f59e0b"]

  // TEXT TOOL STATE
  const [textSize, setTextSize] = useState(20)
  const [presets, setPresets] = useState<TextPreset[]>(DEFAULT_PRESETS)
  const [activePresetId, setActivePresetId] = useState<string>('p2')

  const userId = "teacher-1"
  const [uploadStatus, setUploadStatus] = useState("")

  // --- RECORDING LOGIC ---
  const uploadToR2 = async (blob: Blob, filename: string): Promise<string> => {
    // A. Request the Signed URL
    const response = await fetch('/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType: blob.type })
    })

    if (!response.ok) throw new Error("Failed to get upload URL")

    // Get the Clean Type back from server
    const { url, cleanType } = await response.json()

    // B. Upload to R2 with the matching Content-Type
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)

      // CRITICAL: This must match what the server signed!
      xhr.setRequestHeader('Content-Type', cleanType)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploadStatus(`Uploading: ${percent}%`)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${filename}`
          resolve(publicUrl)
        } else {
          reject(new Error(`R2 rejected upload. Status: ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error("Network error"))
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
        const filename = `${studentId || 'lesson'}_${Date.now()}.webm`

        setUploadStatus("Uploading...")
        setIsRecording(false)

        try {
          const publicUrl = await uploadToR2(blob, filename)

          setUploadStatus("Saving to database...")

          const { error } = await supabase.from('classroom_recordings').insert({
            student_id: studentId || 'guest',
            teacher_id: userId,
            filename: `Lesson - ${new Date().toLocaleDateString()}`,
            url: publicUrl,
            size_bytes: blob.size
          })

          if (error) throw error

          setUploadStatus("")
          alert("✅ Recording saved!")

        } catch (e) {
          console.error(e)
          setUploadStatus("Error!")
          alert("Upload failed. Downloading locally instead.")

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
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // 1. LOAD PRESETS FROM DB
  useEffect(() => {
    const loadPresets = async () => {
      const { data } = await supabase
        .from('classroom_presets')
        .select('data')
        .eq('user_id', userId)
        .eq('preset_type', 'text_tool')
        .single()

      if (data?.data) {
        setPresets(data.data as any)
      }
    }
    loadPresets()
  }, [])

  // 2. SAVE PRESETS TO DB
  const savePresetToDB = async (updatedPresets: TextPreset[]) => {
    setPresets(updatedPresets) // Update UI immediately

    // Save to Supabase
    const { error } = await supabase
      .from('classroom_presets')
      .upsert({
        user_id: userId,
        preset_type: 'text_tool',
        data: updatedPresets,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, preset_type' })

    if (error) console.error("Error saving presets:", error)
  }

  // Handle Creating New Preset
  const handleSaveCurrentStyle = () => {
    const name = prompt("Name this preset? (e.g. 'Chords')")
    if (!name) return

    const newPreset: TextPreset = {
      id: Date.now().toString(),
      name,
      fontSize: textSize,
      color: penColor // Uses the current pen color state
    }

    const updated = [...presets, newPreset]
    savePresetToDB(updated)
    setActivePresetId(newPreset.id)
  }

  // Apply Preset
  const applyPreset = (id: string) => {
    const preset = presets.find(p => p.id === id)
    if (preset) {
      setActivePresetId(id)
      setTextSize(preset.fontSize)
      setPenColor(preset.color)

      // Auto-trigger text if selected from presets
      if (musicContainerRef.current) {
        musicContainerRef.current.addText({
          color: preset.color,
          fontSize: preset.fontSize
        })
        setActiveTool('select')
      } else {
        setActiveTool('text')
      }
    }
  }

  const handleTriggerText = () => {
    if (musicContainerRef.current) {
      musicContainerRef.current.addText({
        color: penColor,
        fontSize: textSize
      })
      setActiveTool('select')
    } else {
      setActiveTool('text')
    }
  }

  const handleTextStyleChange = (changes: any) => {
    if (musicContainerRef.current) {
      musicContainerRef.current.updateActiveObject(changes)
    }
  }

  const handleTextDelete = () => {
    if (musicContainerRef.current) {
      musicContainerRef.current.deleteActiveObject()
    }
  }

  const saveToHistory = (newStrokes: Stroke[], newTexts: TextAnnotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ strokes: newStrokes, texts: newTexts })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setIsSaved(false)
  }

  const saveAnnotations = () => {
    const annotationData: SavedAnnotations = {
      strokes,
      textAnnotations,
      savedAt: new Date().toISOString(),
      sheetMusicId: "current-sheet-music", // Replace with actual sheet music ID
    }
    localStorage.setItem("sheet-music-annotations", JSON.stringify(annotationData))
    setIsSaved(true)
  }

  useEffect(() => {
    const saved = localStorage.getItem("sheet-music-annotations")
    if (saved) {
      try {
        const data: SavedAnnotations = JSON.parse(saved)
        setStrokes(data.strokes)
        setTextAnnotations(data.textAnnotations)
        setIsSaved(true)
      } catch (e) {
        console.error("Failed to load saved annotations:", e)
      }
    }
  }, [])

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setStrokes(prevState.strokes)
      setTextAnnotations(prevState.texts)
      setHistoryIndex(historyIndex - 1)
      setIsSaved(false)
    } else if (historyIndex === 0) {
      setStrokes([])
      setTextAnnotations([])
      setHistoryIndex(-1)
      setIsSaved(false)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setStrokes(nextState.strokes)
      setTextAnnotations(nextState.texts)
      setHistoryIndex(historyIndex + 1)
      setIsSaved(false)
    }
  }

  const clearAll = () => {
    saveToHistory([], [])
    setStrokes([])
    setTextAnnotations([])
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeCanvas = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      redrawCanvas()
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [])

  useEffect(() => {
    redrawCanvas()
  }, [strokes, currentStroke])

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw all saved strokes
      ;[...strokes, ...(currentStroke ? [currentStroke] : [])].forEach((stroke) => {
        if (stroke.points.length < 2) return
        ctx.beginPath()
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        if (stroke.tool === "highlighter") {
          ctx.globalAlpha = 0.3
        } else {
          ctx.globalAlpha = 1
        }
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        stroke.points.forEach((point) => {
          ctx.lineTo(point.x, point.y)
        })
        ctx.stroke()
        ctx.globalAlpha = 1
      })
  }

  const getCanvasPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeTool) return
    const pos = getCanvasPosition(e)

    if (activeTool === "text") {
      setPendingTextPosition(pos)
      setIsAddingText(true)
      return
    }

    if (activeTool === "pen" || activeTool === "highlighter") {
      const newStroke: Stroke = {
        points: [pos],
        color: penColor,
        width: activeTool === "highlighter" ? 20 : 3,
        tool: activeTool,
      }
      setCurrentStroke(newStroke)
    }

    if (activeTool === "eraser") {
      // Check if we're clicking on a stroke to erase
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Find and remove strokes near the click
      const eraserRadius = 10
      const newStrokes = strokes.filter((stroke) => {
        return !stroke.points.some(
          (point) => Math.abs(point.x - pos.x) < eraserRadius && Math.abs(point.y - pos.y) < eraserRadius,
        )
      })
      if (newStrokes.length !== strokes.length) {
        setStrokes(newStrokes)
        saveToHistory(newStrokes, textAnnotations)
      }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentStroke || (activeTool !== "pen" && activeTool !== "highlighter")) return
    const pos = getCanvasPosition(e)
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, pos],
    })
  }

  const handleCanvasMouseUp = () => {
    if (currentStroke && currentStroke.points.length > 1) {
      const newStrokes = [...strokes, currentStroke]
      setStrokes(newStrokes)
      saveToHistory(newStrokes, textAnnotations)
    }
    setCurrentStroke(null)
  }

  const handleAddText = (text: string) => {
    if (!pendingTextPosition || !text.trim()) {
      setIsAddingText(false)
      setPendingTextPosition(null)
      return
    }
    const newText: TextAnnotation = {
      id: Date.now().toString(),
      x: pendingTextPosition.x,
      y: pendingTextPosition.y,
      text: text.trim(),
      color: penColor,
    }
    const newTexts = [...textAnnotations, newText]
    setTextAnnotations(newTexts)
    saveToHistory(strokes, newTexts) // Fixed undeclared variable newStrokes
    setIsAddingText(false)
    setPendingTextPosition(null)
  }

  // Placeholder for TeacherVideo and StudentVideo removal - replaced by VideoConference


  const AnnotationToolbar = () => (
    <div className="flex items-center gap-1 lg:gap-2 px-2 py-1.5 bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
      {/* Tool buttons */}
      <Button
        variant={activeTool === "select" ? "default" : "ghost"}
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => setActiveTool(activeTool === "select" ? null : "select")}
        title="Select"
      >
        <MousePointer2 className="w-4 h-4" />
      </Button>
      <Button
        variant={activeTool === "pen" ? "default" : "ghost"}
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => setActiveTool(activeTool === "pen" ? null : "pen")}
        title="Pen"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        variant={activeTool === "highlighter" ? "default" : "ghost"}
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => setActiveTool(activeTool === "highlighter" ? null : "highlighter")}
        title="Highlighter"
      >
        <Highlighter className="w-4 h-4" />
      </Button>
      <Popover>
        <div className="flex items-center bg-zinc-800/50 rounded-md border border-zinc-700 mx-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-r-none"
            onClick={handleTriggerText}
            title="Add Text"
          >
            <Type className="w-4 h-4" />
          </Button>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="w-6 h-8 p-0 rounded-l-none border-l border-zinc-700 hover:bg-zinc-700">
              <Settings2 className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-64 bg-zinc-900 border-zinc-800 p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Text Size: {textSize}px</Label>
            <div className="flex items-center gap-3">
              <span className="text-xs">A</span>
              <input
                type="range"
                min="12"
                max="72"
                value={textSize}
                onChange={(e) => {
                  const size = Number(e.target.value)
                  setTextSize(size)
                  handleTextStyleChange({ fontSize: size })
                }}
                className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-lg">A</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Style</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => handleTextStyleChange({ fontWeight: 'bold' })}
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => handleTextStyleChange({ fontStyle: 'italic' })}
              >
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => handleTextStyleChange({ underline: true })}
              >
                <Underline className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-zinc-700 bg-red-900/20 hover:bg-red-900/40 text-red-400"
                onClick={handleTextDelete}
                title="Delete Object"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <select
                className="h-8 text-xs bg-zinc-800 border border-zinc-700 rounded px-2 flex-1 text-zinc-300"
                onChange={(e) => handleTextStyleChange({ fontFamily: e.target.value })}
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times</option>
                <option value="Courier New">Courier</option>
                <option value="Georgia">Georgia</option>
                <option value="Inter">Inter</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`text-xs px-2 py-1.5 rounded border text-left truncate transition-colors ${activePresetId === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                onClick={handleSaveCurrentStyle}
              >
                <Plus className="w-3 h-3 mr-2" /> Save Current Style
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant={activeTool === "eraser" ? "default" : "ghost"}
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => setActiveTool(activeTool === "eraser" ? null : "eraser")}
        title="Eraser"
      >
        <Eraser className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Color picker */}
      <div className="flex items-center gap-1">
        {colors.map((color) => (
          <button
            key={color}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${penColor === color ? "border-foreground scale-110" : "border-transparent"
              }`}
            style={{ backgroundColor: color }}
            onClick={() => {
              setPenColor(color)
              handleTextStyleChange({ fill: color })
            }}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Undo/Redo/Clear */}
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => musicContainerRef.current?.undo()} title="Undo">
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => musicContainerRef.current?.redo()}
        title="Redo"
      >
        <Redo2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-8 h-8 p-0 text-destructive hover:text-destructive"
        onClick={clearAll}
        title="Clear All"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant={isSaved ? "ghost" : "default"}
        size="sm"
        className={`w-8 h-8 p-0 ${!isSaved ? "bg-primary text-primary-foreground" : ""}`}
        onClick={saveAnnotations}
        title={isSaved ? "Annotations saved" : "Save annotations"}
      >
        <Save className="w-4 h-4" />
      </Button>
    </div>
  )

  const isMobile = useIsMobile()
  const [showSheetMusic, setShowSheetMusic] = useState(false)

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* View mode switcher - Only on Desktop */}
      {!isMobile && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-sidebar">
          <span className="text-sm font-medium text-muted-foreground">View</span>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "sheet-music" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setViewMode("sheet-music")}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sheet Music</span>
            </Button>
            <Button
              variant={viewMode === "dual-widescreen" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setViewMode("dual-widescreen")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dual View</span>
            </Button>
            <Button
              variant={viewMode === "picture-in-picture" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setViewMode("picture-in-picture")}
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PiP</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* DESKTOP LAYOUT */}
        {!isMobile && (
          <>
            {viewMode === "sheet-music" && (
              <div className="h-full flex flex-col lg:flex-row">
                <div className="flex-1 lg:w-[70%] p-3 lg:p-4 flex flex-col min-h-0">
                  <div className="flex-1 rounded-xl border-2 border-border bg-card overflow-hidden flex flex-col">
                    <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 lg:gap-3">
                        {!isStudent ? (
                          <PieceSelector
                            userId="teacher-1"
                            selectedPiece={activePiece as Piece | null}
                            onSelectPiece={(piece) => piece && setRoomPiece(piece as ActivePiece)}
                          />
                        ) : (
                          <>
                            <Music className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                            <span className="font-medium text-foreground text-sm lg:text-base">
                              {activePiece?.title || "Waiting for teacher..."}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Hide annotation toolbar for students */}
                        {!isStudent && <AnnotationToolbar />}
                        <div className="hidden sm:flex items-center gap-1 lg:gap-2 ml-2">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs lg:text-sm px-2">-</Button>
                          <span className="text-xs lg:text-sm text-muted-foreground">100%</span>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs lg:text-sm px-2">+</Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 relative bg-zinc-900 overflow-hidden">
                      {activePiece ? (
                        <HorizontalMusicContainer
                          ref={musicContainerRef}
                          xmlUrl={activePiece.xml_url}
                          songId={activePiece.id}
                          studentId={studentId || "student-1"}
                          hideToolbar={isStudent}
                          externalTool={isStudent ? 'scroll' : (activeTool === 'eraser' ? 'eraser' : (activeTool === 'pen' || activeTool === 'highlighter' ? 'pen' : (activeTool === 'select' ? 'select' : activeTool || 'scroll')))}
                          externalColor={penColor}
                          externalTextSize={textSize}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">
                          {isStudent ? "Waiting for teacher to select a piece..." : "Select a piece to begin"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hidden lg:flex lg:w-[30%] p-3 lg:p-4 lg:pl-0 flex-col gap-3 lg:gap-4">
                  <div className="h-full w-full">
                    <VerticalVideoStack />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "dual-widescreen" && (
              <div className="h-full p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
                <div className="flex-1 flex flex-col justify-center gap-3 lg:gap-4 max-w-5xl mx-auto w-full">
                  <div className="h-full w-full">
                    <VerticalVideoStack />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "picture-in-picture" && (
              <div className="h-full p-3 lg:p-4 relative">
                <div className="h-full flex items-center justify-center">
                  <div className="w-full h-full max-w-6xl">
                    <VerticalVideoStack />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4 gap-1.5 text-xs"
                  onClick={() => setPipPosition(pipPosition === "right" ? "left" : "right")}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Move PiP</span>
                </Button>
              </div>
            )}
          </>
        )}

        {/* MOBILE LAYOUT */}
        {isMobile && (
          <div className="relative h-full w-full flex flex-col">
            {/* LAYER A: The Video (Always rendered) */}
            <div className={`flex-grow h-full w-full ${showSheetMusic ? 'hidden' : 'block'}`}>
              <VerticalVideoStack />
            </div>

            {/* LAYER B: The Sheet Music (Only when toggled) */}
            {showSheetMusic && (
              <div className="flex-grow bg-background z-10 flex flex-col h-full">
                <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <span className="font-medium text-sm">Sheet Music</span>
                  {/* Hide annotation toolbar for students */}
                  {!isStudent && <AnnotationToolbar />}
                </div>
                <div
                  ref={containerRef}
                  className="flex-1 relative bg-muted/30"
                  style={{ cursor: activeTool ? "crosshair" : "default" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center space-y-2 p-4">
                      <Music className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Sheet Music Canvas</p>
                    </div>
                  </div>
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={handleCanvasMouseDown}
                    onTouchMove={handleCanvasMouseMove}
                    onTouchEnd={handleCanvasMouseUp}
                  />
                  {textAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="absolute text-sm font-medium pointer-events-none"
                      style={{
                        left: annotation.x,
                        top: annotation.y,
                        color: annotation.color,
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      }}
                    >
                      {annotation.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LAYER C: The Toggle Button (Floating) */}
            <div className="absolute bottom-20 right-4 z-50">
              <Button
                onClick={() => setShowSheetMusic(!showSheetMusic)}
                size="lg"
                className="rounded-full shadow-xl font-bold gap-2"
              >
                {showSheetMusic ? (
                  <>
                    <Video className="w-5 h-5" /> Show Video
                  </>
                ) : (
                  <>
                    <Music className="w-5 h-5" /> Show Sheets
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Control Bar - Always Visible */}
      <div className="border-t border-border bg-sidebar p-3 lg:p-4 z-50">
        <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto">
          {/* Left Controls */}
          <div className="flex items-center gap-2 lg:gap-3">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-4 h-4 lg:w-5 lg:h-5" /> : <Mic className="w-4 h-4 lg:w-5 lg:h-5" />}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "secondary"}
              size="icon"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full"
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? (
                <VideoOff className="w-4 h-4 lg:w-5 lg:h-5" />
              ) : (
                <Video className="w-4 h-4 lg:w-5 lg:h-5" />
              )}
            </Button>
          </div>

          {/* Center - Music Mode Toggle */}
          <div
            className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 rounded-full border-2 transition-all ${isMusicMode ? "bg-primary/20 border-primary" : "bg-secondary border-border"
              }`}
          >
            <MessageSquare
              className={`w-4 h-4 lg:w-5 lg:h-5 ${!isMusicMode ? "text-primary" : "text-muted-foreground"}`}
            />
            <Switch
              checked={isMusicMode}
              onCheckedChange={setIsMusicMode}
              className="data-[state=checked]:bg-primary"
            />
            <Music className={`w-4 h-4 lg:w-5 lg:h-5 ${isMusicMode ? "text-primary" : "text-muted-foreground"}`} />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 lg:gap-3">
            {uploadStatus ? (
              <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-900/20 px-3 py-1.5 rounded-full border border-yellow-500/30">
                <Circle className="w-3 h-3 animate-spin" />
                {uploadStatus}
              </div>
            ) : (
              <Button
                variant={isRecording ? "destructive" : "secondary"}
                className={`gap-2 text-xs lg:text-sm ${isRecording ? "animate-pulse" : ""}`}
                size="sm"
                onClick={handleRecordClick}
              >
                <Circle className={`w-3 h-3 lg:w-4 lg:h-4 ${isRecording ? "fill-current" : ""}`} />
                <span className="hidden sm:inline">{isRecording ? "Stop" : "Record"}</span>
              </Button>
            )}

            <Button variant="destructive" size="icon" className="w-10 h-10 lg:w-12 lg:h-12 rounded-full">
              <PhoneOff className="w-4 h-4 lg:w-5 lg:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
