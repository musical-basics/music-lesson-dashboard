"use client"

import { useState, useEffect } from "react"
import { GreenRoom } from "@/components/green-room"
import { LessonInterface } from "@/components/lesson-interface"
import { RecitalStage } from "@/components/recital-stage"
import { Music, Users, Video } from "lucide-react"
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"

type View = "green-room" | "lesson" | "recital"


import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

function SidebarContent({
  currentView,
  setCurrentView,
  onNavigate
}: {
  currentView: View,
  setCurrentView: (view: View) => void,
  onNavigate?: () => void
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


import { useSearchParams } from 'next/navigation'

export default function MusicStudioPage() {
  const [currentView, setCurrentView] = useState<View>("green-room")
  const [token, setToken] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'student'

  useEffect(() => {
    (async () => {
      try {
        console.log("Fetching token..."); // LOG 1
        console.log("Server URL:", process.env.NEXT_PUBLIC_LIVEKIT_URL); // Debug Server URL

        // 1. Generate a UNIQUE identity based on the mode
        // This prevents the "Kick off" bug.
        // Teacher is always "teacher" (so you reconnect to the same session)
        // Student gets a random ID so multiple students don't clash
        const uniqueIdentity = mode === 'teacher'
          ? 'teacher-main'
          : `student-${Math.floor(Math.random() * 1000)}`;

        console.log(`Connecting as: ${uniqueIdentity} (Mode: ${mode})`);

        const resp = await fetch(`/api/token?room=test&username=${uniqueIdentity}&role=${mode}`);
        const data = await resp.json();
        console.log("Token received:", data.token); // LOG 2
        setToken(data.token);
      } catch (e) {
        console.error("Token fetch failed:", e); // LOG 3
      }
    })();
  }, [mode]);

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
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <SidebarContent currentView={currentView} setCurrentView={setCurrentView} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden h-[calc(100vh-65px)] md:h-screen">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          connect={true}
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
          {currentView === "green-room" && <GreenRoom onJoin={() => setCurrentView("lesson")} />}
          {currentView === "lesson" && <LessonInterface />}
          {currentView === "recital" && <RecitalStage />}
          <RoomAudioRenderer />
        </LiveKitRoom>
      </main>
    </div>
  )
}
