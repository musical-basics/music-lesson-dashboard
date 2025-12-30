"use client"
import { useEffect, useRef, useState } from 'react'
import { Canvas, PencilBrush } from 'fabric'

interface AnnotationRailProps {
    totalWidth: number
    height: number
    activeTool: 'scroll' | 'pen' | 'eraser'
    clearTrigger: number
    songId: string // <--- NEW PROP: The unique ID of the current song
}

const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height, activeTool, clearTrigger, songId }: AnnotationRailProps) {
    const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);

    return (
        <div
            className="absolute top-0 left-0 z-10 flex"
            style={{ width: totalWidth, height: height }}
        >
            {Array.from({ length: chunkCount }).map((_, i) => (
                <AnnotationChunk
                    key={`${songId}-chunk-${i}`} // Force re-render when song changes
                    index={i}
                    width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                    height={height}
                    activeTool={activeTool}
                    clearTrigger={clearTrigger}
                    songId={songId} // Pass it down
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, index, activeTool, clearTrigger, songId }: {
    width: number, height: number, index: number,
    activeTool: 'scroll' | 'pen' | 'eraser',
    clearTrigger: number,
    songId: string
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true;
        if (!canvasRef.current) return

        const canvas = new Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: 'transparent',
            selection: false,
        })

        const brush = new PencilBrush(canvas)
        brush.color = "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        // --- KEY CHANGE: NAMESPACED STORAGE ---
        const chunkKey = `annotation-${songId}-tile-${index}`
        // -------------------------------------

        const saved = localStorage.getItem(chunkKey)
        if (saved) {
            try {
                canvas.loadFromJSON(JSON.parse(saved), () => {
                    if (isMounted.current) canvas.requestRenderAll()
                })
            } catch (e) { console.error(e) }
        }

        canvas.on('path:created', () => {
            if (!isMounted.current) return
            localStorage.setItem(chunkKey, JSON.stringify(canvas.toJSON()))
        })

        fabricRef.current = canvas

        // Handle Deletion (Eraser)
        canvas.on('mouse:down', (opt) => {
            if (activeTool === 'eraser' && opt.target) {
                canvas.remove(opt.target)
                canvas.requestRenderAll()
                localStorage.setItem(chunkKey, JSON.stringify(canvas.toJSON())) // Update storage
            }
        })

        return () => {
            isMounted.current = false
            try { canvas.dispose() } catch (e) { }
        }
    }, [width, height, index, songId]) // Re-run if songId changes

    // ... (Keep existing activeTool and clearTrigger useEffects exactly as they were) ...
    // Re-paste the tool logic here:
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current
        if (activeTool === 'pen') {
            canvas.isDrawingMode = true
            canvas.defaultCursor = 'crosshair'
            canvas.hoverCursor = 'crosshair'
            canvas.off('mouse:down') // Disable eraser logic
        } else if (activeTool === 'eraser') {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'cell'
            canvas.hoverCursor = 'cell'
            // Eraser logic is added in the init effect above
        } else {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'default'
        }
    }, [activeTool])

    useEffect(() => {
        if (clearTrigger > 0 && fabricRef.current) {
            fabricRef.current.clear()
            fabricRef.current.backgroundColor = 'transparent'
            fabricRef.current.requestRenderAll()
            localStorage.removeItem(`annotation-${songId}-tile-${index}`) // Updated Key
        }
    }, [clearTrigger, index, songId])

    const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

    return (
        <div style={{ width, height, pointerEvents: pointerEvents as any }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
