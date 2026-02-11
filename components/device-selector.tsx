"use client"

import React from "react"
import { useMediaDeviceSelect } from "@livekit/components-react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Camera, Mic } from "lucide-react"

export function MediaDeviceSettings() {
    const video = useMediaDeviceSelect({ kind: "videoinput" })
    const audio = useMediaDeviceSelect({ kind: "audioinput" })

    return (
        <div className="grid gap-4 py-2">
            <div className="space-y-2">
                <Label>Camera</Label>
                <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <Select
                        value={video.activeDeviceId}
                        onValueChange={video.setActiveMediaDevice}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Camera" />
                        </SelectTrigger>
                        <SelectContent>
                            {video.devices.map((device) => (
                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Microphone</Label>
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                    <Select
                        value={audio.activeDeviceId}
                        onValueChange={audio.setActiveMediaDevice}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Microphone" />
                        </SelectTrigger>
                        <SelectContent>
                            {audio.devices.map((device) => (
                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
