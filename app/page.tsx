"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from 'next/navigation'
import { GreenRoom } from "@/components/green-room"
import { LessonInterface } from "@/components/lesson-interface"
import { RecitalStage } from "@/components/recital-stage"
import { Music, Users, Video, LayoutDashboard, Menu } from "lucide-react"
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react"
import "@livekit/components-styles"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

type View = "green-room" | "lesson" | "recital"

function SidebarContent({
  currentView,
  setCurrentView,
  onNavigate,
  role
}: {
  currentView: View,
  setCurrentView: (view: View) => void,
  onNavigate?: () => void,
  role?: string
}) {
  const handleNav = (view: View) => {
    setCurrentView(view)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Music Studio</h1>
            <p className="text-xs text-muted-foreground">Pro Lessons</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {/* Only show Dashboard if NOT a student */}
        {role !== 'student' && (
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </Link>
        )}
        {role !== 'student' && <div className="mx-4 my-2 border-t border-border/50" />}

        <button
          onClick={() => handleNav("green-room")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === "green-room"
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
        >
          <Video className="w-5 h-5" />
          <span className="font-medium">Green Room</span>
        </button>

        <button
          onClick={() => handleNav("lesson")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === "lesson"
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
        >
          <Music className="w-5 h-5" />
          <span className="font-medium">Lesson Interface</span>
        </button>

        <button
          onClick={() => handleNav("recital")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === "recital"
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Recital Stage</span>
        </button>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">Preview Mode • Switch views above</div>
      </div>
    </div>
  )
}

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
  const [userChoices, setUserChoices] = useState<{
    videoDeviceId: string;
    audioDeviceId: string;
  } | null>(null);

  // 2. AUTO-JOIN LOGIC (The Fix)
  useEffect(() => {
    // If we have a room and a name in the URL, we should connect immediately
    if (roomParam && nameParam && !token) {
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
  }, [roomParam, nameParam, roleParam, keyParam, token])

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
            <SidebarContent
              currentView={currentView}
              setCurrentView={setCurrentView}
              onNavigate={() => setIsMobileMenuOpen(false)}
              role={roleParam}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <SidebarContent currentView={currentView} setCurrentView={setCurrentView} role={roleParam} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden h-[calc(100vh-65px)] md:h-screen">
        <LiveKitRoom
          video={userChoices && currentView !== 'green-room' ? { deviceId: userChoices.videoDeviceId } : false}
          audio={userChoices && currentView !== 'green-room' ? { deviceId: userChoices.audioDeviceId } : false}
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
          {currentView === "lesson" && (
            <LessonInterface
              studentId={studentIdParam || 'guest'}
            />
          )}
          {currentView === "recital" && <RecitalStage />}
          <RoomAudioRenderer />
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
