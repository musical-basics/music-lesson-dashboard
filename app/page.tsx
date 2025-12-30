"use client"

import { useState, useEffect } from "react"
import { GreenRoom } from "@/components/green-room"
import { LessonInterface } from "@/components/lesson-interface"
import { RecitalStage } from "@/components/recital-stage"
import { Music, Users, Video } from "lucide-react"
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"

type View = "green-room" | "lesson" | "recital"

export default function MusicStudioPage() {
  const [currentView, setCurrentView] = useState<View>("green-room")
  const [token, setToken] = useState("")

  useEffect(() => {
    (async () => {
      try {
        console.log("Fetching token..."); // LOG 1
        console.log("Server URL:", process.env.NEXT_PUBLIC_LIVEKIT_URL); // Debug Server URL

        const resp = await fetch(`/api/token?room=test&username=teacher`);
        const data = await resp.json();
        console.log("Token received:", data.token); // LOG 2
        setToken(data.token);
      } catch (e) {
        console.error("Token fetch failed:", e); // LOG 3
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
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
            onClick={() => setCurrentView("green-room")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === "green-room"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
          >
            <Video className="w-5 h-5" />
            <span className="font-medium">Green Room</span>
          </button>

          <button
            onClick={() => setCurrentView("lesson")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === "lesson"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
          >
            <Music className="w-5 h-5" />
            <span className="font-medium">Lesson Interface</span>
          </button>

          <button
            onClick={() => setCurrentView("recital")}
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
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
