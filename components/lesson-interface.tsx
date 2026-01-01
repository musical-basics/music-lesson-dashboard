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
} from "lucide-react"
import { VideoConference } from "@livekit/components-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { HorizontalMusicContainer } from "@/components/horizontal-music-container"

type ViewMode = "sheet-music" | "dual-widescreen" | "picture-in-picture"
type AnnotationTool = "pen" | "highlighter" | "text" | "eraser" | null

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

  const colors = ["#ef4444", "#8b5cf6", "#22c55e", "#3b82f6", "#f59e0b"]

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
      <Button
        variant={activeTool === "text" ? "default" : "ghost"}
        size="sm"
        className="w-8 h-8 p-0"
        onClick={() => setActiveTool(activeTool === "text" ? null : "text")}
        title="Add Text"
      >
        <Type className="w-4 h-4" />
      </Button>
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
            onClick={() => setPenColor(color)}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Undo/Redo/Clear */}
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={undo} disabled={historyIndex < 0} title="Undo">
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-8 h-8 p-0"
        onClick={redo}
        disabled={historyIndex >= history.length - 1}
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
                        <Music className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                        <span className="font-medium text-foreground text-sm lg:text-base">Sheet Music</span>
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
                      <HorizontalMusicContainer
                        xmlUrl="/xmls/La Campanella Remix v8.musicxml"
                        songId="la-campanella"
                        studentId={studentId || "student-1"}
                        hideToolbar={isStudent} // Teacher sees toolbar and broadcasts, Student hides and receives
                        // Force scroll mode for students (read-only), otherwise use chosen tool
                        externalTool={isStudent ? 'scroll' : (activeTool === 'eraser' ? 'eraser' : (activeTool === 'pen' || activeTool === 'highlighter' ? 'pen' : 'scroll'))}
                        externalColor={penColor}
                      />
                    </div>
                  </div>
                </div>

                <div className="hidden lg:flex lg:w-[30%] p-3 lg:p-4 lg:pl-0 flex-col gap-3 lg:gap-4">
                  <div className="h-full w-full">
                    <VideoConference />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "dual-widescreen" && (
              <div className="h-full p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
                <div className="flex-1 flex flex-col justify-center gap-3 lg:gap-4 max-w-5xl mx-auto w-full">
                  <div className="h-full w-full">
                    <VideoConference />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "picture-in-picture" && (
              <div className="h-full p-3 lg:p-4 relative">
                <div className="h-full flex items-center justify-center">
                  <div className="w-full h-full max-w-6xl">
                    <VideoConference />
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
              <VideoConference />
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
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              className={`gap-2 text-xs lg:text-sm ${isRecording ? "animate-pulse" : ""}`}
              size="sm"
              onClick={() => setIsRecording(!isRecording)}
            >
              <Circle className={`w-3 h-3 lg:w-4 lg:h-4 ${isRecording ? "fill-current" : ""}`} />
              <span className="hidden sm:inline">{isRecording ? "Rec" : "Record"}</span>
            </Button>

            <Button variant="destructive" size="icon" className="w-10 h-10 lg:w-12 lg:h-12 rounded-full">
              <PhoneOff className="w-4 h-4 lg:w-5 lg:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
