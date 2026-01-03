"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Music,
  LayoutGrid,
  Maximize2,
  PictureInPicture2,
  Video
} from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { SheetMusicPanel } from "@/components/sheet-music-panel"
import { PieceSelector } from "@/components/piece-selector"
import { Piece } from "@/types/piece"
import { useRoomSync, ActivePiece } from "@/hooks/use-room-sync"
import { VideoAspectRatio, VideoPanel, VerticalVideoStack } from "@/components/video-panel"


type ViewMode = "sheet-music" | "dual-widescreen" | "picture-in-picture"


interface LessonInterfaceProps {
  studentId?: string
}

export function LessonInterface({ studentId }: LessonInterfaceProps) {
  // Get the Role from URL
  const searchParams = useSearchParams()
  const role = searchParams.get('role')
  const isStudent = role === 'student'

  // LiveKit local participant for camera/mic control

  const [viewMode, setViewMode] = useState<ViewMode>("sheet-music")
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>("widescreen")
  const [pipPosition, setPipPosition] = useState<"left" | "right">("right")






  // Room Sync: Teacher broadcasts, Student receives
  const { activePiece, setRoomPiece, isLoading: isRoomLoading } = useRoomSync(
    studentId || "student-1",
    isStudent ? 'student' : 'teacher'
  )





  // Placeholder for TeacherVideo and StudentVideo removal - replaced by VideoConference


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

            {/* Separator */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* Video Aspect Ratio Selector */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-0.5">
              <Button
                variant={videoAspectRatio === "widescreen" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setVideoAspectRatio("widescreen")}
                title="Widescreen (16:9)"
              >
                16:9
              </Button>
              <Button
                variant={videoAspectRatio === "standard" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setVideoAspectRatio("standard")}
                title="Standard (4:3)"
              >
                4:3
              </Button>
              <Button
                variant={videoAspectRatio === "portrait" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setVideoAspectRatio("portrait")}
                title="Portrait (9:16)"
              >
                9:16
              </Button>
            </div>
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
                        {/* Annotation Toolbar moved inside SheetMusicPanel */}
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
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={videoAspectRatio}
                      onAspectRatioChange={setVideoAspectRatio}
                      showOverlay={false}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "dual-widescreen" && (
              <div className="h-full p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
                <div className="flex-1 flex flex-col justify-center gap-3 lg:gap-4 max-w-5xl mx-auto w-full">
                  <div className="h-full w-full">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={videoAspectRatio}
                      onAspectRatioChange={setVideoAspectRatio}
                      showOverlay={false}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {viewMode === "picture-in-picture" && (
              <div className="h-full p-3 lg:p-4 relative">
                <div className="h-full flex items-center justify-center">
                  <div className="w-full h-full max-w-6xl">
                    <VideoPanel
                      studentId={studentId}
                      isStudent={isStudent}
                      aspectRatio={videoAspectRatio}
                      onAspectRatioChange={setVideoAspectRatio}
                      showOverlay={false}
                      className="h-full w-full"
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
                  aspectRatio={videoAspectRatio}
                  onAspectRatioChange={setVideoAspectRatio}
                  showOverlay={true}
                  className="h-full w-full"
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
          </div>
        )}

      </div>


    </div>
  )
}
