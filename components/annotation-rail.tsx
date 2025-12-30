"use client"
import { useEffect, useRef, useState } from 'react'
import { Canvas, PencilBrush } from 'fabric'

interface AnnotationRailProps {
    totalWidth: number
    height: number
    activeTool: 'scroll' | 'pen' | 'eraser' // New Prop
    clearTrigger: number // New Prop (Increment to trigger clear)
}

const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height, activeTool, clearTrigger }: AnnotationRailProps) {
    const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);

    return (
        <div
            className="absolute top-0 left-0 z-10 flex"
            style={{ width: totalWidth, height: height }}
        >
            {Array.from({ length: chunkCount }).map((_, i) => (
                <AnnotationChunk
                    key={i}
                    index={i}
                    width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                    height={height}
                    activeTool={activeTool}
                    clearTrigger={clearTrigger}
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, index, activeTool, clearTrigger }: {
    width: number, height: number, index: number,
    activeTool: 'scroll' | 'pen' | 'eraser',
    clearTrigger: number
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const isMounted = useRef(true)

    // 1. Initialize Canvas
    useEffect(() => {
        isMounted.current = true;
        if (!canvasRef.current) return

        const canvas = new Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: 'transparent',
            selection: false, // Disable group selection box
        })

        // Setup Pen
        const brush = new PencilBrush(canvas)
        brush.color = "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        // Load Data
        const chunkKey = `annotation-tile-${index}`
        const saved = localStorage.getItem(chunkKey)
        if (saved) {
            try {
                canvas.loadFromJSON(JSON.parse(saved), () => {
                    if (isMounted.current) canvas.requestRenderAll()
                })
            } catch (e) { console.error(e) }
        }

        // Save on Add
        canvas.on('path:created', () => saveCanvas(canvas, chunkKey))

        fabricRef.current = canvas

        return () => {
            isMounted.current = false
            try { canvas.dispose() } catch (e) { }
        }
    }, [width, height, index]) // Re-init if size changes

    // 2. Handle Tool Changes (Pen vs Eraser vs Scroll)
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        if (activeTool === 'pen') {
            canvas.isDrawingMode = true
            canvas.defaultCursor = 'crosshair'
            canvas.hoverCursor = 'crosshair'
            // Disable click-to-delete logic
            canvas.off('mouse:down')
        }
        else if (activeTool === 'eraser') {
            canvas.isDrawingMode = false // Stop drawing
            canvas.defaultCursor = 'cell' // Eraser icon cursor
            canvas.hoverCursor = 'cell'

            // Enable "Click/Tap to Delete" logic
            canvas.on('mouse:down', (opt) => {
                if (opt.target) {
                    canvas.remove(opt.target)
                    canvas.requestRenderAll()
                    saveCanvas(canvas, `annotation-tile-${index}`)
                }
            })
        }
        else {
            // Scroll Mode
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'default'
            canvas.off('mouse:down')
        }

    }, [activeTool, index])

    // 3. Handle Clear All Signal
    useEffect(() => {
        // If clearTrigger is 0, it's the initial render, don't clear
        if (clearTrigger > 0 && fabricRef.current) {
            fabricRef.current.clear()
            fabricRef.current.backgroundColor = 'transparent' // Reset bg after clear
            fabricRef.current.requestRenderAll()
            localStorage.removeItem(`annotation-tile-${index}`)
        }
    }, [clearTrigger, index])

    // Helper to save
    const saveCanvas = (canvas: Canvas, key: string) => {
        if (!isMounted.current) return
        const json = JSON.stringify(canvas.toJSON())
        localStorage.setItem(key, json)
    }

    // Pointer Events Logic: 
    // If 'scroll' mode, we disable pointer events so clicks pass through to the music.
    // If 'pen' or 'eraser', we enable them so we can interact with the canvas.
    const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

    return (
        <div style={{ width, height, pointerEvents: pointerEvents as any }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
