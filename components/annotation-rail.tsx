"use client"
import { useEffect, useRef } from 'react'
import { Canvas, PencilBrush } from 'fabric' // Make sure you ran: npm install fabric

interface AnnotationRailProps {
    totalWidth: number
    height: number
}

// 2000px is a safe limit for mobile browsers (iOS Canvas limit)
const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height }: AnnotationRailProps) {
    // 1. Calculate how many "Tiles" we need to cover the song
    const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);

    return (
        <div
            className="absolute top-0 left-0 z-10 flex"
            // IMPORTANT: We do NOT set pointer-events here. 
            // We let the Parent (HorizontalMusicContainer) control touch/click access.
            style={{ width: totalWidth, height: height }}
        >
            {Array.from({ length: chunkCount }).map((_, i) => (
                <AnnotationChunk
                    key={i}
                    index={i}
                    width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                    height={height}
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, index }: { width: number, height: number, index: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Use a Ref to track if component is unmounted (prevents the crash)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true;
        if (!canvasRef.current) return

        // 1. Init Fabric Canvas
        const canvas = new Canvas(canvasRef.current, {
            width,
            height,
            isDrawingMode: true,
            backgroundColor: 'transparent',
        })

        // 2. Setup Red Pen
        const brush = new PencilBrush(canvas)
        brush.color = "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        // 3. Robust Persistence Loading
        const chunkKey = `annotation-tile-${index}`
        const saved = localStorage.getItem(chunkKey)

        if (saved) {
            try {
                const json = JSON.parse(saved);
                // loadFromJSON is async! We must wait for it.
                canvas.loadFromJSON(json, () => {
                    // Only render if the component is still alive
                    if (!isMounted.current) return;

                    // THE FIX: Force a re-render immediately after data loads
                    canvas.requestRenderAll();
                })
            } catch (e) {
                console.error("Failed to load annotation", e)
            }
        }

        // 4. Save on Draw
        canvas.on('path:created', () => {
            if (!isMounted.current) return;
            const json = JSON.stringify(canvas.toJSON())
            localStorage.setItem(chunkKey, json)
        })

        return () => {
            isMounted.current = false;
            // Wrap dispose in a try-catch to silence the 'clearRect' error during hot-reloads
            try {
                canvas.dispose();
            } catch (e) {
                // suppress disposal errors
            }
        }
    }, [width, height, index])

    return (
        <div style={{ width, height, borderRight: '1px dashed rgba(0,0,0,0.1)' }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
