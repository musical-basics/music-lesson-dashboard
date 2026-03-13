"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from 'next/navigation'
import { GreenRoom } from "@/components/green-room"
import { LessonInterface } from "@/components/lesson-interface"
import { RecitalStage } from "@/components/recital-stage"
import { Music, Menu, Video } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react"
import "@livekit/components-styles"
import { AudioUnlockOverlay } from "@/components/audio-unlock-overlay"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

type View = "green-room" | "lesson" | "recital"



function MusicStudioContent() {
  const searchParams = useSearchParams()

  // 1. READ URL PARAMS
  const viewParam = searchParams.get('view') as View
  const roomParam = searchParams.get('room')
  const nameParam = searchParams.get('name')
  const roleParam = searchParams.get('role') || 'student'
  const keyParam = searchParams.get('key') || ''
  const studentIdParam = searchParams.get('studentId')

  const [currentView, setCurrentView] = useState<View>(viewParam || "green-room")
  const [token, setToken] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasLeftLesson, setHasLeftLesson] = useState(false)
  const [userChoices, setUserChoices] = useState<{
    videoDeviceId: string;
    audioDeviceId: string;
  } | null>(null);
  // Students need a user gesture (click) before we can request camera permissions.
  // Teachers auto-join because they're on their own machine with permissions granted.
  const isStudentRole = roleParam === 'student'
  const [needsUserGesture, setNeedsUserGesture] = useState(isStudentRole && viewParam === 'lesson')

  // 2. AUTO-JOIN LOGIC — Teachers only (students wait for button click)
  useEffect(() => {
    const targetView = viewParam || 'green-room';

    // Skip auto-join for students (they need a user gesture for camera permission)
    if (isStudentRole) return

    if (targetView !== 'green-room' && roomParam && nameParam && !token) {
      const fetchToken = async () => {
        try {
          console.log(`🔌 Auto-joining room: ${roomParam} as ${nameParam}`)
          const resp = await fetch(
            `/api/token?room=${roomParam}&username=${nameParam}&role=${roleParam}&key=${keyParam}`
          )
          const data = await resp.json()
          setToken(data.token)
        } catch (e) {
          console.error("Failed to auto-join:", e)
        }
      }
      fetchToken()
    }
  }, [viewParam, roomParam, nameParam, roleParam, keyParam, token, isStudentRole])

  // Student clicks "Join Lesson" — this user gesture allows the browser to prompt for camera
  const handleStudentJoin = async () => {
    const identity = nameParam || `Guest-${Math.floor(Math.random() * 1000)}`
    const roomName = roomParam || 'demo-room'

    console.log("🎓 Student joining room:", roomName, "as", identity)

    try {
      const resp = await fetch(
        `/api/token?room=${roomName}&username=${identity}&role=${roleParam}&key=${keyParam}`
      )
      const data = await resp.json()
      if (data.error) {
        alert(data.error)
        return
      }
      setToken(data.token)
      setNeedsUserGesture(false)
    } catch (e) {
      console.error("Failed to join:", e)
      alert("Could not connect to room")
    }
  }

  // Sync 'currentView' state with URL param if it changes externally
  useEffect(() => {
    if (viewParam && ['green-room', 'lesson', 'recital'].includes(viewParam)) {
      setCurrentView(viewParam)
    }
  }, [viewParam])

  const handleGreenRoomJoin = async (choices: { videoDeviceId: string; audioDeviceId: string }) => {
    setUserChoices(choices)

    // Determine Identity
    // If name param exists (from Dashboard), use it. Otherwise generate random.
    const identity = nameParam || `Guest-${Math.floor(Math.random() * 1000)}`
    const roomName = roomParam || 'demo-room'

    console.log("Joing Room:", roomName, "as", identity);

    try {
      const resp = await fetch(
        `/api/token?room=${roomName}&username=${identity}&role=${roleParam}&key=${keyParam}`
      )
      const data = await resp.json()
      if (data.error) {
        alert(data.error)
        return
      }
      setToken(data.token)

      // Auto-switch to lesson view
      setCurrentView("lesson")
    } catch (e) {
      console.error("Failed to join:", e)
      alert("Could not connect to room")
    }
  }

  // --- MEDIA LOGIC FIX ---
  // If userChoices exists (from Green Room), use those IDs.
  // If NOT (Teacher auto-join), default to 'true' (System Default) if we are in a live view.
  const isLiveView = currentView !== 'green-room';

  const videoProp = isLiveView
    ? (userChoices ? { deviceId: userChoices.videoDeviceId } : true)
    : false;

  const audioProp = isLiveView
    ? (userChoices ? { deviceId: userChoices.audioDeviceId } : true)
    : false;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Music className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">Music Studio</span>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <DashboardSidebar
              className="flex w-full h-full border-r-0"
              currentView={currentView}
              onNavigate={(view) => {
                setCurrentView(view as View)
                setIsMobileMenuOpen(false)
              }}
              role={roleParam}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar Navigation */}
      <DashboardSidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view as View)}
        role={roleParam}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden h-[calc(100vh-65px)] md:h-screen">
        <LiveKitRoom
          video={videoProp}
          audio={audioProp}
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          connect={!!token}
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
          {currentView === "green-room" && (
            <GreenRoom
              onJoin={handleGreenRoomJoin}
            />
          )}
          {currentView === "lesson" && needsUserGesture && (
            <div className="flex items-center justify-center h-full bg-background">
              <div className="text-center space-y-6 p-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto border border-primary/10">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Ready to join?</h2>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Your browser will ask for camera and microphone access.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg font-semibold rounded-xl"
                  onClick={handleStudentJoin}
                >
                  Join Lesson
                </Button>
              </div>
            </div>
          )}
          {currentView === "lesson" && !needsUserGesture && (
            <LessonInterface
              studentId={studentIdParam || 'guest'}
              hasLeftLesson={hasLeftLesson}
              onLeaveLesson={() => setHasLeftLesson(true)}
              onRejoinLesson={() => setHasLeftLesson(false)}
            />
          )}
          {currentView === "recital" && <RecitalStage />}
          <RoomAudioRenderer />
          <AudioUnlockOverlay />
        </LiveKitRoom>
      </main>
    </div>
  )
}

export default function MusicStudioPage() {
  return (
    <Suspense fallback={<div>Loading Studio...</div>}>
      <MusicStudioContent />
    </Suspense>
  )
}
