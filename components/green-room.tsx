"use client"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Mic, Volume2, Loader2 } from "lucide-react"
import {
  createLocalVideoTrack,
  createLocalAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack
} from "livekit-client"
import { VideoTrack } from "@livekit/components-react"

interface GreenRoomProps {
  onJoin?: (options: { audioDeviceId: string; videoDeviceId: string }) => void
}

export function GreenRoom({ onJoin }: GreenRoomProps) {
  // 1. The Real Hardware Tracks
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);

  // 2. Device Lists
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // 3. Selected Device IDs
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");

  // 4. Fake Audio Level (Real one requires WebAudio API context, usually overkill for Green Room)
  const [audioLevel, setAudioLevel] = useState(0)

  // --- MOUNT: Get Devices & Start Camera ---
  useEffect(() => {
    const enableTracks = async () => {
      try {
        // A. Ask for permissions & Get Devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        const audioDevs = devices.filter(d => d.kind === 'audioinput');

        setVideoDevices(videoDevs);
        setAudioDevices(audioDevs);

        // Set defaults if not set
        if (!selectedVideoId && videoDevs.length > 0) setSelectedVideoId(videoDevs[0].deviceId);
        if (!selectedAudioId && audioDevs.length > 0) setSelectedAudioId(audioDevs[0].deviceId);

        // B. Start Video Preview
        const vTrack = await createLocalVideoTrack({
          deviceId: selectedVideoId,
          resolution: { width: 1280, height: 720 }
        });
        setVideoTrack(vTrack);

      } catch (error) {
        console.error("Error accessing media:", error);
      }
    };

    enableTracks();

    // Cleanup: Turn off camera when component unmounts
    return () => {
      videoTrack?.stop();
    };
  }, []); // Run once on mount

  // --- SWITCHING DEVICES ---
  // When user picks a new camera, restart the track
  useEffect(() => {
    if (!selectedVideoId) return;

    // Stop old track
    if (videoTrack) videoTrack.stop();

    // Start new track
    createLocalVideoTrack({ deviceId: selectedVideoId }).then(track => {
      setVideoTrack(track);
    });
  }, [selectedVideoId]);


  // --- VISUALS ---
  // Keep your existing Audio Animation (It's a nice UI touch)
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 0.5 + 0.2);
    }, 100);
    return () => clearInterval(interval);
  }, []);


  const handleJoin = () => {
    // Kill the preview tracks so the Real Room can take over
    videoTrack?.stop();
    audioTrack?.stop();

    // Pass the selected IDs up to the main page
    if (onJoin) onJoin({
      audioDeviceId: selectedAudioId,
      videoDeviceId: selectedVideoId
    });
  }

  // --- VIDEO REF ---
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 lg:p-8 bg-background overflow-auto">
      <div className="max-w-2xl w-full space-y-6 lg:space-y-8">

        <div className="text-center space-y-1 lg:space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Green Room</h1>
          <p className="text-sm lg:text-base text-muted-foreground">Set up your audio and video before joining</p>
        </div>

        {/* --- VIDEO PREVIEW --- */}
        <div className="w-full">
          <div className="aspect-video rounded-xl overflow-hidden border-2 border-border bg-card relative">
            {videoTrack ? (
              // THIS IS THE REAL CAMERA FEED
              // THIS IS THE REAL CAMERA FEED
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
              />
            ) : (
              // Loading State
              <div className="w-full h-full flex items-center justify-center bg-black">
                <Loader2 className="animate-spin text-white w-8 h-8" />
              </div>
            )}

            <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-white">Live Preview</span>
            </div>
          </div>
        </div>

        {/* --- DEVICE SELECTORS --- */}
        <div className="grid gap-4 lg:gap-6">

          {/* MICROPHONE */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" /> Microphone
            </label>
            <div className="flex gap-4">
              <Select value={selectedAudioId} onValueChange={setSelectedAudioId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select Mic" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Visualizer Bar */}
              <div className="w-32 h-10 bg-secondary rounded-md flex items-end p-1 gap-1 overflow-hidden">
                {[...Array(10)].map((_, i) => (
                  <div key={i}
                    className={`flex-1 rounded-t-sm transition-all duration-75 ${i / 10 < audioLevel ? 'bg-green-500' : 'bg-gray-700'}`}
                    style={{ height: `${i / 10 < audioLevel ? 100 : 20}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* CAMERA */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Camera
            </label>
            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Camera" />
              </SelectTrigger>
              <SelectContent>
                {videoDevices.map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* --- JOIN BUTTON --- */}
        <Button size="lg" className="w-full" onClick={handleJoin}>
          Join Studio
        </Button>

      </div>
    </div>
  )
}
