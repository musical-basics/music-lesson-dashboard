"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Star, Volume2, VolumeX, UserMinus, Users, X } from "lucide-react"

const mockParticipants = [
  { id: 1, name: "Emma S.", isPerformer: false },
  { id: 2, name: "Lucas M.", isPerformer: false },
  { id: 3, name: "Sophie K.", isPerformer: false },
  { id: 4, name: "Oliver P.", isPerformer: false },
  { id: 5, name: "Isabella R.", isPerformer: false },
  { id: 6, name: "Noah T.", isPerformer: false },
  { id: 7, name: "Ava W.", isPerformer: false },
  { id: 8, name: "William D.", isPerformer: false },
]

export function RecitalStage() {
  const [isMuted, setIsMuted] = useState(true)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [participants, setParticipants] = useState(mockParticipants)
  const [showAdminPanel, setShowAdminPanel] = useState(true)
  const [mutedParticipants, setMutedParticipants] = useState<number[]>([])

  const handleSpotlight = (id: number) => {
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        isPerformer: p.id === id ? !p.isPerformer : false,
      })),
    )
  }

  const handleMuteParticipant = (id: number) => {
    setMutedParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const handleMuteAll = () => {
    setMutedParticipants(participants.map((p) => p.id))
  }

  const handleRemoveParticipant = (id: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  const currentPerformer = participants.find((p) => p.isPerformer)

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Main Stage Area */}
      <div className="flex-1 p-3 lg:p-6 flex flex-col gap-3 lg:gap-4 overflow-hidden">
        {/* Performer Stage - Center with forced 16:9 */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-full max-w-5xl">
            <div className="aspect-video rounded-xl lg:rounded-2xl overflow-hidden border-2 border-primary/50 bg-card shadow-2xl shadow-primary/10">
              <div className="relative w-full h-full bg-gradient-to-br from-secondary to-card flex items-center justify-center">
                {currentPerformer ? (
                  <>
                    <div className="text-center space-y-2 lg:space-y-4">
                      <div className="w-16 h-16 lg:w-32 lg:h-32 rounded-full bg-primary/20 mx-auto flex items-center justify-center border-2 lg:border-4 border-primary/30">
                        <span className="text-2xl lg:text-5xl font-bold text-primary">
                          {currentPerformer.name.charAt(0)}
                        </span>
                      </div>
                      <p className="text-lg lg:text-2xl font-medium text-foreground">{currentPerformer.name}</p>
                      <p className="text-xs lg:text-base text-muted-foreground">Now Performing</p>
                    </div>
                    {/* Stage Label */}
                    <div className="absolute top-2 lg:top-4 left-2 lg:left-4 flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1 lg:py-2 rounded-full bg-primary/20 border border-primary/30">
                      <Star className="w-3 h-3 lg:w-4 lg:h-4 text-primary fill-primary" />
                      <span className="text-xs lg:text-sm font-medium text-primary">On Stage</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-2 lg:space-y-4">
                    <div className="w-16 h-16 lg:w-32 lg:h-32 rounded-full bg-muted mx-auto flex items-center justify-center border-2 border-dashed border-border">
                      <Star className="w-8 h-8 lg:w-16 lg:h-16 text-muted-foreground" />
                    </div>
                    <p className="text-base lg:text-xl font-medium text-muted-foreground">Stage Empty</p>
                    <p className="text-xs lg:text-sm text-muted-foreground">Spotlight a performer to begin</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audience Strip - 16:9 thumbnails */}
        <div className="flex-shrink-0 h-20 lg:h-28 bg-secondary/30 rounded-lg lg:rounded-xl border border-border p-2 lg:p-3">
          <div className="flex items-center gap-2 lg:gap-3 h-full overflow-x-auto pb-1">
            <div className="flex-shrink-0 flex items-center gap-2 px-2 lg:px-3 text-muted-foreground border-r border-border pr-3 lg:pr-4">
              <Users className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="text-xs lg:text-sm font-medium">{participants.length}</span>
            </div>
            {participants
              .filter((p) => !p.isPerformer)
              .map((participant) => (
                <div
                  key={participant.id}
                  className="flex-shrink-0 h-full rounded-md lg:rounded-lg overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="h-full aspect-video flex flex-col items-center justify-center gap-0.5 lg:gap-1 p-1 lg:p-2">
                    <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-medium text-foreground">
                        {participant.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-[10px] lg:text-xs text-muted-foreground truncate max-w-full text-center px-1">
                      {participant.name.split(" ")[0]}
                    </span>
                    {mutedParticipants.includes(participant.id) && (
                      <MicOff className="w-2 h-2 lg:w-3 lg:h-3 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="border-t border-border bg-sidebar p-3 lg:p-4">
        <div className="flex items-center justify-center gap-2 lg:gap-3">
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
            {isVideoOff ? <VideoOff className="w-4 h-4 lg:w-5 lg:h-5" /> : <Video className="w-4 h-4 lg:w-5 lg:h-5" />}
          </Button>

          <Button variant="destructive" size="icon" className="w-10 h-10 lg:w-12 lg:h-12 rounded-full">
            <PhoneOff className="w-4 h-4 lg:w-5 lg:h-5" />
          </Button>
        </div>
      </div>

      {/* Teacher Admin Panel (Floating Overlay) */}
      {showAdminPanel && (
        <div className="absolute bottom-20 left-2 right-2 lg:bottom-auto lg:left-auto lg:top-4 lg:right-4 lg:w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground text-sm lg:text-base">Admin Panel</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdminPanel(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Mute All Button */}
          <div className="p-2 lg:p-3 border-b border-border">
            <Button variant="destructive" className="w-full gap-2 text-sm" size="sm" onClick={handleMuteAll}>
              <VolumeX className="w-4 h-4" />
              Mute All
            </Button>
          </div>

          {/* Participant List */}
          <div className="max-h-48 lg:max-h-64 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="px-3 lg:px-4 py-2 border-b border-border last:border-0 flex items-center justify-between hover:bg-secondary/30"
              >
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium text-foreground">{participant.name.charAt(0)}</span>
                  </div>
                  <span className="text-xs lg:text-sm text-foreground">{participant.name}</span>
                  {participant.isPerformer && <Star className="w-3 h-3 text-primary fill-primary" />}
                </div>

                <div className="flex items-center gap-0.5 lg:gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 lg:w-8 lg:h-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleSpotlight(participant.id)}
                    title="Spotlight to Stage"
                  >
                    <Star
                      className={`w-3 h-3 lg:w-4 lg:h-4 ${participant.isPerformer ? "fill-primary text-primary" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-7 h-7 lg:w-8 lg:h-8 ${mutedParticipants.includes(participant.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => handleMuteParticipant(participant.id)}
                    title="Mute"
                  >
                    {mutedParticipants.includes(participant.id) ? (
                      <VolumeX className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <Volume2 className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 lg:w-8 lg:h-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    title="Remove"
                  >
                    <UserMinus className="w-3 h-3 lg:w-4 lg:h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show Admin Panel Button (when hidden) */}
      {!showAdminPanel && (
        <Button
          className="absolute top-2 right-2 lg:top-4 lg:right-4 gap-2 text-xs lg:text-sm"
          variant="secondary"
          size="sm"
          onClick={() => setShowAdminPanel(true)}
        >
          <Users className="w-3 h-3 lg:w-4 lg:h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
      )}
    </div>
  )
}
