"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Mic, Volume2, Play, Loader2 } from "lucide-react"

interface GreenRoomProps {
  onJoin?: () => void
}

export function GreenRoom({ onJoin }: GreenRoomProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [isTestingAudio, setIsTestingAudio] = useState(false)
  const [selectedMic, setSelectedMic] = useState("default")
  const [selectedCamera, setSelectedCamera] = useState("default")
  const [selectedSpeaker, setSelectedSpeaker] = useState("default")
  const animationRef = useRef<number | null>(null)

  // Simulate audio level animation
  useEffect(() => {
    const animate = () => {
      setAudioLevel(Math.random() * 0.6 + Math.sin(Date.now() / 200) * 0.2 + 0.2)
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleTestAudio = () => {
    setIsTestingAudio(true)
    setTimeout(() => setIsTestingAudio(false), 2000)
  }

  const getAudioLevelColor = (level: number) => {
    if (level > 0.8) return "bg-red-500"
    if (level > 0.6) return "bg-yellow-500"
    return "bg-success"
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 lg:p-8 bg-background overflow-auto">
      <div className="max-w-2xl w-full space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="text-center space-y-1 lg:space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Green Room</h1>
          <p className="text-sm lg:text-base text-muted-foreground">Set up your audio and video before joining</p>
        </div>

        {/* Video Preview Card - 16:9 enforced */}
        <div className="w-full">
          <div className="aspect-video rounded-xl overflow-hidden border-2 border-border bg-card">
            <div className="relative w-full h-full bg-gradient-to-br from-secondary to-card flex items-center justify-center">
              <div className="text-center space-y-3 lg:space-y-4">
                <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-full bg-primary/20 mx-auto flex items-center justify-center">
                  <Camera className="w-8 h-8 lg:w-12 lg:h-12 text-primary" />
                </div>
                <p className="text-sm lg:text-base text-muted-foreground">Camera Preview</p>
              </div>

              {/* Live indicator */}
              <div className="absolute top-3 lg:top-4 left-3 lg:left-4 flex items-center gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-foreground">Preview</span>
              </div>
            </div>
          </div>
        </div>

        {/* Device Selectors */}
        <div className="grid gap-4 lg:gap-6">
          {/* Microphone with Audio Level */}
          <div className="space-y-2 lg:space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Microphone Input
            </label>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <Select value={selectedMic} onValueChange={setSelectedMic}>
                <SelectTrigger className="flex-1 bg-input border-border text-foreground text-sm">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="default">Default - MacBook Pro Microphone</SelectItem>
                  <SelectItem value="usb">USB Audio Interface</SelectItem>
                  <SelectItem value="external">External Condenser Mic</SelectItem>
                </SelectContent>
              </Select>

              {/* Audio Level Meter */}
              <div className="w-full sm:w-32 h-8 bg-input rounded-md overflow-hidden flex items-center px-2 gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-4 rounded-sm transition-all duration-75 ${i / 20 < audioLevel ? getAudioLevelColor(i / 20) : "bg-muted"
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Camera */}
          <div className="space-y-2 lg:space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Camera Input
            </label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="bg-input border-border text-foreground text-sm">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="default">Default - FaceTime HD Camera</SelectItem>
                <SelectItem value="external">External Webcam HD 1080p</SelectItem>
                <SelectItem value="capture">Capture Card Input</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Speaker */}
          <div className="space-y-2 lg:space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              Speaker Output
            </label>
            <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
              <SelectTrigger className="bg-input border-border text-foreground text-sm">
                <SelectValue placeholder="Select speaker" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="default">Default - MacBook Pro Speakers</SelectItem>
                <SelectItem value="headphones">Studio Headphones</SelectItem>
                <SelectItem value="monitors">External Studio Monitors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border text-sm lg:text-base"
            onClick={handleTestAudio}
            disabled={isTestingAudio}
          >
            {isTestingAudio ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
            )}
            Test Audio
          </Button>

          <Button
            size="lg"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 text-sm lg:text-base"
            onClick={onJoin}
          >
            <span className="relative flex items-center gap-2">
              <span className="absolute -left-1 w-3 h-3 rounded-full bg-primary-foreground/30 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-primary-foreground" />
              Join Studio
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
