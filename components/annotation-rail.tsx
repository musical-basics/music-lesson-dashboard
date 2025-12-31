"use client"
import { useEffect, useRef } from 'react'
import { Canvas, PencilBrush } from 'fabric'
import { AnnotationState } from '@/hooks/use-lesson-state'

interface AnnotationRailProps {
    totalWidth: number
    height: number
    activeTool: 'scroll' | 'pen' | 'eraser'
    clearTrigger: number
    data: AnnotationState
    onSave: (newData: AnnotationState) => void
}

const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height, activeTool, clearTrigger, data, onSave }: AnnotationRailProps) {
    const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);

    const handleChunkSave = (index: number, chunkData: any) => {
        onSave({
            ...data,
            [index]: chunkData
        })
    }

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
                    initialData={data[i]} // Pass specific chunk data
                    onSave={(chunkData) => handleChunkSave(i, chunkData)}
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, activeTool, clearTrigger, initialData, onSave }: {
    width: number, height: number, index: number,
    activeTool: 'scroll' | 'pen' | 'eraser',
    clearTrigger: number,
    initialData: any,
    onSave: (data: any) => void
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
            selection: false,
        })

        // Setup Brush
        const brush = new PencilBrush(canvas)
        brush.color = "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        // Save Events
        canvas.on('path:created', () => {
            if (isMounted.current) onSave(canvas.toJSON())
        })

        // Eraser Events
        canvas.on('mouse:down', (opt) => {
            // We handle the actual removal logic in the Tool Effect below,
            // but we need to trigger a save after the removal happens.
            // We'll rely on the tool logic to call save, or do it here if needed.
        })

        fabricRef.current = canvas

        return () => {
            isMounted.current = false
            try { canvas.dispose() } catch (e) { }
        }
    }, [width, height])

    // 2. REACTIVE DATA LOADER (The Fix)
    // This watches 'initialData'. If it changes (e.g. swiching students),
    // we wipe the canvas and load the new JSON.
    useEffect(() => {
        if (!fabricRef.current) return;

        const canvas = fabricRef.current;

        // Avoid infinite loops: Only load if the canvas is empty or explicitly different
        // Ideally, we trust the parent to only change initialData when switching contexts

        if (initialData) {
            try {
                canvas.loadFromJSON(initialData, () => {
                    if (isMounted.current) canvas.requestRenderAll()
                })
            } catch (e) { console.error("Error loading chunk", e) }
        } else {
            // If no data exists for this student, clear the canvas!
            canvas.clear();
            canvas.backgroundColor = 'transparent';
            canvas.requestRenderAll();
        }
    }, [initialData]) // <--- THIS is what makes it switch between students

    // 3. Tool Logic
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        if (activeTool === 'pen') {
            canvas.isDrawingMode = true
            canvas.defaultCursor = 'crosshair'
            canvas.hoverCursor = 'crosshair'
            canvas.off('mouse:down')
        } else if (activeTool === 'eraser') {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'cell'
            canvas.hoverCursor = 'cell'

            // Re-bind eraser click logic here to ensure it uses current tool state
            canvas.off('mouse:down');
            canvas.on('mouse:down', (opt) => {
                if (opt.target) {
                    canvas.remove(opt.target)
                    canvas.requestRenderAll()
                    onSave(canvas.toJSON()) // Save after erase
                }
            })
        } else {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'default'
            canvas.off('mouse:down')
        }
    }, [activeTool])

    // 4. Clear Logic
    useEffect(() => {
        if (clearTrigger > 0 && fabricRef.current) {
            fabricRef.current.clear()
            fabricRef.current.backgroundColor = 'transparent'
            fabricRef.current.requestRenderAll()
            onSave(fabricRef.current.toJSON()) // Save the empty state
        }
    }, [clearTrigger])

    const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

    return (
        <div style={{ width, height, pointerEvents: pointerEvents as any }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
