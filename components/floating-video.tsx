"use client"
import { useState, useRef, useEffect } from 'react'
import { GripHorizontal, MicOff, Video, VideoOff, Minimize2, Maximize2 } from 'lucide-react'

export function FloatingVideo() {
    const [position, setPosition] = useState({ x: 20, y: 20 })
    const [isDragging, setIsDragging] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

    // Fake drag logic (simple offset calculation)
    const dragStart = useRef({ x: 0, y: 0 })

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            })
        }
        const handleMouseUp = () => setIsDragging(false)

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging])

    return (
        <div
            className="fixed z-50 bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden flex flex-col"
            style={{
                left: position.x,
                top: position.y,
                width: isMinimized ? '200px' : '320px',
                transition: isDragging ? 'none' : 'width 0.2s, height 0.2s'
            }}
        >
            {/* Header / Drag Handle */}
            <div
                onMouseDown={handleMouseDown}
                className="bg-zinc-800 p-2 cursor-move flex items-center justify-between group"
            >
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <GripHorizontal className="w-4 h-4" />
                    <span className="font-semibold">Student Cam</span>
                </div>
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="text-zinc-500 hover:text-white"
                >
                    {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </button>
            </div>

            {/* Video Area */}
            {!isMinimized && (
                <div className="relative bg-black aspect-video flex items-center justify-center">
                    {/* Placeholder for LiveKit Track */}
                    <span className="text-zinc-600 text-sm">Video Feed Here</span>

                    {/* Overlay Controls */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                        <div className="p-2 bg-red-500/90 rounded-full text-white"><MicOff className="w-3 h-3" /></div>
                        <div className="p-2 bg-zinc-800/80 rounded-full text-white"><Video className="w-3 h-3" /></div>
                    </div>
                </div>
            )}
        </div>
    )
}
