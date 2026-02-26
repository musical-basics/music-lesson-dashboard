"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Music,
  LayoutGrid,
  Columns2,
  Maximize2,
  PictureInPicture2,
  Video,
  Lock,
  Unlock
} from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { SheetMusicPanel } from "@/components/sheet-music-panel"
import { PieceSelector } from "@/components/piece-selector"
import { Piece } from "@/types/piece"
import { useRoomSync, ActivePiece, ViewMode, AspectRatio } from "@/hooks/use-room-sync"
import { VideoAspectRatio, VideoPanel, AudioProcessingSettings } from "@/components/video-panel"
import { PieceXmlEditor } from "@/components/piece-xml-editor"
import { useToast } from "@/hooks/use-toast"


interface LessonInterfaceProps {
  studentId?: string
}

export function LessonInterface({ studentId }: LessonInterfaceProps) {
  // Get the Role from URL
  const searchParams = useSearchParams()
  const role = searchParams.get('role')
  const isStudent = role === 'student'

  // Room Sync: Teacher broadcasts, Student receives
  const { activePiece, setRoomPiece, settings, setRoomSettings, isLoading: isRoomLoading } = useRoomSync(
    studentId || "student-1",
    isStudent ? 'student' : 'teacher'
  )

  // Local view state (for teacher, or for student when not controlled)
  const [localViewMode, setLocalViewMode] = useState<ViewMode>("dual-widescreen")
  const [localAspectRatio, setLocalAspectRatio] = useState<AspectRatio>("widescreen")
  const [pipPosition, setPipPosition] = useState<"left" | "right">("right")
  const [isEditingXml, setIsEditingXml] = useState(false)
  const { toast } = useToast()

  // Derive effective view mode based on teacher control
  const isControlled = isStudent && settings.teacherControlEnabled
  const effectiveViewMode = isControlled ? settings.viewMode : localViewMode
  const effectiveAspectRatio = isControlled ? settings.aspectRatio : localAspectRatio

  // Sync local state with room settings when teacher control is enabled
  useEffect(() => {
    if (isControlled) {
      setLocalViewMode(settings.viewMode)
      setLocalAspectRatio(settings.aspectRatio)
    }
  }, [isControlled, settings.viewMode, settings.aspectRatio])

  // Handler for view mode changes
  const handleViewModeChange = (mode: ViewMode) => {
    if (isControlled) return
    setLocalViewMode(mode)

    // Broadcast if teacher control is on (should be handled by effect, but specific explicit action)
    if (!isStudent && settings.teacherControlEnabled) {
      setRoomSettings({
        ...settings,
        viewMode: mode
      })
    }
  }

  // Handle saving XML from editor
  const handleSaveXml = async (newXmlContent: string) => {
    if (!activePiece) return

    // 1. Create File object
    const blob = new Blob([newXmlContent], { type: 'text/xml' })
    const file = new File([blob], `${activePiece.id}.musicxml`, { type: 'text/xml' })

    // 2. Prepare FormData
    const formData = new FormData()
    formData.append('xml_file', file)
    formData.append('user_id', "teacher-1") // Hardcoded ID matching PieceSelector usage

    // 3. Upload via internal API
    const response = await fetch(`/api/pieces/${activePiece.id}`, {
      method: 'PUT',
      body: formData
    })

    if (!response.ok) {
      throw new Error("Failed to save XML")
    }

    // 4. Reload page to reflect changes (simplest way to ensure all peers get new content/caches cleared)
    window.location.reload()
  }

  // Handler for aspect ratio changes
  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setLocalAspectRatio(ratio)
    if (!isStudent && settings.teacherControlEnabled) {
      // Teacher with control enabled - broadcast to students
      setRoomSettings({ aspectRatio: ratio })
    }
  }

  // Handler for teacher control toggle
  const handleTeacherControlToggle = (enabled: boolean) => {
    setRoomSettings({
      teacherControlEnabled: enabled,
      viewMode: localViewMode,
      aspectRatio: localAspectRatio
    })
  }

  // Handler for audio settings changes
  const handleAudioSettingsChange = (newSettings: Partial<AudioProcessingSettings>) => {
    const updated = {
      echoCancellation: newSettings.echoCancellation ?? settings.echoCancellation,
      noiseSuppression: newSettings.noiseSuppression ?? settings.noiseSuppression,
      autoGainControl: newSettings.autoGainControl ?? settings.autoGainControl,
    }
    if (!isStudent && settings.teacherControlEnabled) {
      // Teacher with control: broadcast to students
      setRoomSettings(updated)
    } else if (!isControlled) {
      // Not controlled: update locally via room sync
      setRoomSettings(updated)
    }
  }

  // Handler for teacher controlling student's audio settings
  const handleStudentAudioSettingsChange = (newSettings: Partial<AudioProcessingSettings>) => {
    if (isStudent) return // Only teacher can change student audio
    setRoomSettings({
      studentEchoCancellation: newSettings.echoCancellation ?? settings.studentEchoCancellation,
      studentNoiseSuppression: newSettings.noiseSuppression ?? settings.studentNoiseSuppression,
      studentAutoGainControl: newSettings.autoGainControl ?? settings.studentAutoGainControl,
    })
  }

  // Teacher sees their own settings; student uses student-specific fields when controlled
  const effectiveAudioSettings: AudioProcessingSettings = isControlled
    ? {
      echoCancellation: settings.studentEchoCancellation,
      noiseSuppression: settings.studentNoiseSuppression,
      autoGainControl: settings.studentAutoGainControl,
    }
    : {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    }

  const studentAudioSettings: AudioProcessingSettings = {
    echoCancellation: settings.studentEchoCancellation,
    noiseSuppression: settings.studentNoiseSuppression,
    autoGainControl: settings.studentAutoGainControl,
  }

  const isMobile = useIsMobile()
  const [showSheetMusic, setShowSheetMusic] = useState(false)

  // Controls are disabled when student is being controlled by teacher
  const controlsDisabled = isControlled

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* View mode switcher - Only on Desktop */}
      {!isMobile && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-sidebar">
          <span className="text-sm font-medium text-muted-foreground">View</span>
          <div className="flex items-center gap-1">
            {/* View Mode Buttons */}
            <div className={`flex items-center gap-1 ${controlsDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Button
                variant={effectiveViewMode === "sheet-music" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleViewModeChange("sheet-music")}
                disabled={controlsDisabled}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sheet Music</span>
              </Button>
              <Button
                variant={effectiveViewMode === "dual-widescreen" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleViewModeChange("dual-widescreen")}
                disabled={controlsDisabled}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dual View</span>
              </Button>
              <Button
                variant={effectiveViewMode === "dual-sidebyside" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleViewModeChange("dual-sidebyside")}
                disabled={controlsDisabled}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Side by Side</span>
              </Button>
              <Button
                variant={effectiveViewMode === "picture-in-picture" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleViewModeChange("picture-in-picture")}
                disabled={controlsDisabled}
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PiP</span>
              </Button>
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* Video Aspect Ratio Selector */}
            <div className={`flex items-center gap-1 bg-secondary/50 rounded-md p-0.5 ${controlsDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Button
                variant={effectiveAspectRatio === "widescreen" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => handleAspectRatioChange("widescreen")}
                disabled={controlsDisabled}
                title="Widescreen (16:9)"
              >
                16:9
              </Button>
              <Button
                variant={effectiveAspectRatio === "standard" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => handleAspectRatioChange("standard")}
                disabled={controlsDisabled}
                title="Standard (4:3)"
              >
                4:3
              </Button>
              <Button
                variant={effectiveAspectRatio === "portrait" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => handleAspectRatioChange("portrait")}
                disabled={controlsDisabled}
                title="Portrait (9:16)"
              >
                9:16
              </Button>
            </div>

            {/* Teacher Control Toggle - Only for Teacher */}
            {!isStudent && (
              <>
                <div className="w-px h-5 bg-border mx-2" />
                <div className="flex items-center gap-2 bg-secondary/50 rounded-md px-2 py-1">
                  {settings.teacherControlEnabled ? (
                    <Lock className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Control</span>
                  <Switch
                    checked={settings.teacherControlEnabled}
                    onCheckedChange={handleTeacherControlToggle}
                    className="scale-75"
                  />
                </div>
              </>
            )}

            {/* Student Indicator when being controlled */}
            {isStudent && settings.teacherControlEnabled && (
              <>
                <div className="w-px h-5 bg-border mx-2" />
                <div className="flex items-center gap-1.5 text-xs text-amber-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Teacher Control</span>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* DESKTOP LAYOUT */}
        {!isMobile && (
          <>
            {effectiveViewMode === "sheet-music" && (
              <div className="h-full flex flex-col lg:flex-row">
                <div className="flex-1 lg:w-[70%] p-3 lg:p-4 flex flex-col min-h-0">
                  <div className="flex-1 rounded-xl border-2 border-border bg-card overflow-hidden flex flex-col">
                    <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 lg:gap-3">
                        {!isStudent ? (
                          <>
                            <PieceSelector
                              userId="teacher-1"
                              selectedPiece={activePiece as Piece | null}
                              onSelectPiece={(piece) => piece && setRoomPiece(piece as ActivePiece)}
                            />
                            {activePiece && !isStudent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingXml(true)}
                                className="h-9 ml-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 hover:text-indigo-200"
                              >
                                <Lock className="w-3 h-3 mr-1.5" />
                                Edit XML
                              </Button>
                            )}
                          </>
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
                        <div className="hidden sm:flex items-center gap-1 lg:gap-2 ml-2">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs lg:text-sm px-2">-</Button>
                          <span className="text-xs lg:text-sm text-muted-foreground">100%</span>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs lg:text-sm px-2">+</Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 relative bg-zinc-900 overflow-hidden">
                      {activePiece ? (
                        <SheetMusicPanel
                          xmlUrl={activePiece.xml_url}
                          songId={activePiece.id}
                          studentId={studentId || "student-1"}
                          isStudent={isStudent}
                          piece={activePiece as Piece}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">
                          {isStudent ? "Waiting for teacher to select a piece..." : "Select a piece to begin"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-[35%] lg:w-[30%] p-3 lg:p-4 lg:pl-0 flex-col gap-3 lg:gap-4">
                  <div className="h-full w-full">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={effectiveAspectRatio as VideoAspectRatio}
                      onAspectRatioChange={(r) => handleAspectRatioChange(r as AspectRatio)}
                      audioSettings={effectiveAudioSettings}
                      onAudioSettingsChange={handleAudioSettingsChange}
                      controlsDisabled={isControlled}
                      showOverlay={false}
                      className="h-full w-full"
                      studentAudioSettings={!isStudent ? studentAudioSettings : undefined}
                      onStudentAudioSettingsChange={!isStudent ? handleStudentAudioSettingsChange : undefined}
                    />
                  </div>
                </div>
              </div>
            )}

            {effectiveViewMode === "dual-widescreen" && (
              <div className="h-full p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
                <div className="flex-1 flex flex-col justify-center gap-3 lg:gap-4 max-w-5xl mx-auto w-full">
                  <div className="h-full w-full">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={effectiveAspectRatio as VideoAspectRatio}
                      onAspectRatioChange={(r) => handleAspectRatioChange(r as AspectRatio)}
                      audioSettings={effectiveAudioSettings}
                      onAudioSettingsChange={handleAudioSettingsChange}
                      controlsDisabled={isControlled}
                      showOverlay={false}
                      className="h-full w-full"
                      studentAudioSettings={!isStudent ? studentAudioSettings : undefined}
                      onStudentAudioSettingsChange={!isStudent ? handleStudentAudioSettingsChange : undefined}
                      controlsPosition="right"
                    />
                  </div>
                </div>
              </div>
            )}

            {effectiveViewMode === "dual-sidebyside" && (
              <div className="h-full p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
                <div className="flex-1 flex flex-col justify-center gap-3 lg:gap-4 w-full">
                  <div className="h-full w-full">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={effectiveAspectRatio as VideoAspectRatio}
                      onAspectRatioChange={(r) => handleAspectRatioChange(r as AspectRatio)}
                      audioSettings={effectiveAudioSettings}
                      onAudioSettingsChange={handleAudioSettingsChange}
                      controlsDisabled={isControlled}
                      showOverlay={false}
                      className="h-full w-full"
                      layout="horizontal"
                      studentAudioSettings={!isStudent ? studentAudioSettings : undefined}
                      onStudentAudioSettingsChange={!isStudent ? handleStudentAudioSettingsChange : undefined}
                      controlsPosition="right"
                    />
                  </div>
                </div>
              </div>
            )}

            {effectiveViewMode === "picture-in-picture" && (
              <div className="h-full p-3 lg:p-4 relative">
                <div className="h-full flex items-center justify-center">
                  <div className="w-full h-full max-w-6xl">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={effectiveAspectRatio as VideoAspectRatio}
                      onAspectRatioChange={(r) => handleAspectRatioChange(r as AspectRatio)}
                      audioSettings={effectiveAudioSettings}
                      onAudioSettingsChange={handleAudioSettingsChange}
                      controlsDisabled={isControlled}
                      showOverlay={false}
                      className="h-full w-full"
                      studentAudioSettings={!isStudent ? studentAudioSettings : undefined}
                      onStudentAudioSettingsChange={!isStudent ? handleStudentAudioSettingsChange : undefined}
                    />
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
            {!showSheetMusic ? (
              <div className="flex-grow h-full w-full relative">
                <VideoPanel
                  studentId={studentId}
                  isStudent={isStudent}
                  aspectRatio={effectiveAspectRatio as VideoAspectRatio}
                  onAspectRatioChange={(r) => handleAspectRatioChange(r as AspectRatio)}
                  audioSettings={effectiveAudioSettings}
                  onAudioSettingsChange={handleAudioSettingsChange}
                  controlsDisabled={isControlled}
                  showOverlay={!controlsDisabled}
                  className="h-full w-full"
                  studentAudioSettings={!isStudent ? studentAudioSettings : undefined}
                  onStudentAudioSettingsChange={!isStudent ? handleStudentAudioSettingsChange : undefined}
                />

              </div>
            ) : (
              <div className="flex-grow bg-background z-10 flex flex-col h-full">
                {activePiece ? (
                  <SheetMusicPanel
                    xmlUrl={activePiece.xml_url}
                    songId={activePiece.id}
                    studentId={studentId || "student-1"}
                    isStudent={isStudent}
                    readOnly={isControlled}
                    piece={activePiece as Piece}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    No piece selected
                  </div>
                )}
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

            {/* Teacher Control Indicator on Mobile */}
            {isStudent && settings.teacherControlEnabled && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-amber-500/90 text-white px-2 py-1 rounded-md text-xs z-50">
                <Lock className="w-3 h-3" />
                <span>Teacher Control</span>
              </div>
            )}
          </div>
        )}

      </div>


      {isEditingXml && activePiece && (
        <PieceXmlEditor
          initialXmlUrl={activePiece.xml_url}
          onClose={() => setIsEditingXml(false)}
          onSave={handleSaveXml}
        />
      )}
    </div>
  )
}
