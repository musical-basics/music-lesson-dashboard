"use client"
import { useEffect, useRef } from 'react'
import { Canvas, PencilBrush } from 'fabric'
import { AnnotationState } from '@/hooks/use-lesson-state'

interface AnnotationRailProps {
    totalWidth: number
    height: number
    activeTool: 'scroll' | 'pen' | 'eraser'
    clearTrigger: number
    songId: string
    data: AnnotationState
    onSave: (newData: AnnotationState) => void
}

const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height, activeTool, clearTrigger, songId, data, onSave }: AnnotationRailProps) {
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
                    key={`${songId}-chunk-${i}`}
                    index={i}
                    width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                    height={height}
                    activeTool={activeTool}
                    clearTrigger={clearTrigger}
                    initialData={data[i]}
                    onSave={(chunkData) => handleChunkSave(i, chunkData)}
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, index, activeTool, clearTrigger, initialData, onSave }: {
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

        const brush = new PencilBrush(canvas)
        brush.color = "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        // Load Initial Data
        if (initialData) {
            try {
                canvas.loadFromJSON(initialData, () => {
                    if (isMounted.current) canvas.requestRenderAll()
                })
            } catch (e) { console.error(e) }
        }

        // Save Events
        canvas.on('path:created', () => {
            if (isMounted.current) onSave(canvas.toJSON())
        })

        fabricRef.current = canvas

        // Eraser Logic
        canvas.on('mouse:down', (opt) => {
            if (activeTool === 'eraser' && opt.target) {
                canvas.remove(opt.target)
                canvas.requestRenderAll()
                onSave(canvas.toJSON())
            }
        })

        return () => {
            isMounted.current = false
            try { canvas.dispose() } catch (e) { }
        }
    }, [width, height]) // Depend only on dimensions (and implicit mount). data changes handled below? NO. 
    // NOTE: We do NOT want to re-init if initialData changes, unless we want to support real-time collaboration updates.
    // For now, simpler: Only load initialData on mount or if keys change.

    // 2. Tool Logic
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current
        if (activeTool === 'pen') {
            canvas.isDrawingMode = true
            canvas.defaultCursor = 'crosshair'
            canvas.hoverCursor = 'crosshair'
            canvas.off('mouse:down') // Disable eraser logic here? No, we handle it in 'mouse:down' check
        } else if (activeTool === 'eraser') {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'cell'
            canvas.hoverCursor = 'cell'
        } else {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'default'
        }
    }, [activeTool])

    // 3. Clear Logic
    useEffect(() => {
        if (clearTrigger > 0 && fabricRef.current) {
            fabricRef.current.clear()
            fabricRef.current.backgroundColor = 'transparent'
            fabricRef.current.requestRenderAll()
            onSave(fabricRef.current.toJSON())
        }
    }, [clearTrigger])

    const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

    return (
        <div style={{ width, height, pointerEvents: pointerEvents as any }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
