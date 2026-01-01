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
    color: string
}

const CHUNK_SIZE = 2000;

export function AnnotationRail({ totalWidth, height, activeTool, clearTrigger, data, onSave, color }: AnnotationRailProps) {
    const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);

    const handleChunkSave = (index: number, chunkData: any) => {
        onSave({
            ...data,
            [index]: chunkData
        })
    }

    // ATOMIC CLEAR: Parent saves ONCE for everyone
    useEffect(() => {
        if (clearTrigger > 0) {
            // Save an empty object to wipe the DB instantly
            onSave({})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearTrigger]) // Intentionally excludes onSave to avoid loops

    return (
        <div
            className="absolute top-0 left-0 z-10 flex"
            style={{ width: totalWidth, height: height }}
        >
            {Array.from({ length: chunkCount }).map((_, i) => (
                <AnnotationChunk
                    // Force remount if data changes significantly to prevent visual ghosts
                    key={`${i}-${Object.keys(data[i] || {}).length}`}
                    index={i}
                    width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                    height={height}
                    activeTool={activeTool}
                    clearTrigger={clearTrigger}
                    initialData={data[i]}
                    onSave={(chunkData) => handleChunkSave(i, chunkData)}
                    color={color}
                />
            ))}
        </div>
    )
}

function AnnotationChunk({ width, height, index, activeTool, clearTrigger, initialData, onSave, color }: {
    width: number, height: number, index: number,
    activeTool: 'scroll' | 'pen' | 'eraser',
    clearTrigger: number,
    initialData: any,
    onSave: (data: any) => void,
    color: string
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
            renderOnAddRemove: true,
        })

        const brush = new PencilBrush(canvas)
        brush.color = color || "#ff0000"
        brush.width = 4
        canvas.freeDrawingBrush = brush

        canvas.on('path:created', () => {
            if (isMounted.current) onSave(canvas.toJSON())
        })

        // Eraser logic is handled in tool effect
        canvas.on('mouse:down', () => { })

        fabricRef.current = canvas

        return () => {
            isMounted.current = false
            try { canvas.dispose() } catch (e) { }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]) // Removed color from deps

    // 2. REACTIVE DATA LOADER
    useEffect(() => {
        if (!fabricRef.current) return;
        const canvas = fabricRef.current;

        if (initialData && Object.keys(initialData).length > 0) {
            try {
                canvas.loadFromJSON(initialData, () => {
                    if (isMounted.current) canvas.requestRenderAll()
                })
            } catch (e) { console.error("Error loading chunk", e) }
        } else {
            // This handles the "Student Receive Clear" case
            canvas.clear();
            canvas.backgroundColor = 'transparent';
            canvas.requestRenderAll();
        }
    }, [initialData])

    // 3. Tool Logic
    useEffect(() => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        if (activeTool === 'pen') {
            canvas.isDrawingMode = true
            canvas.defaultCursor = 'crosshair'
            canvas.hoverCursor = 'crosshair'
            canvas.off('mouse:down')
            if (canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = color || "#ff0000"
            }
        } else if (activeTool === 'eraser') {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'cell'
            canvas.hoverCursor = 'cell'

            canvas.off('mouse:down');
            canvas.on('mouse:down', (opt) => {
                if (opt.target) {
                    canvas.remove(opt.target)
                    canvas.requestRenderAll()
                    onSave(canvas.toJSON())
                }
            })
        } else {
            canvas.isDrawingMode = false
            canvas.defaultCursor = 'default'
            canvas.off('mouse:down')
        }
    }, [activeTool, color, onSave])

    // 4. VISUAL CLEAR (Visual Only - Parent handles DB save)
    useEffect(() => {
        if (clearTrigger > 0 && fabricRef.current) {
            fabricRef.current.clear()
            fabricRef.current.backgroundColor = 'transparent'
            fabricRef.current.requestRenderAll()
            // REMOVED: onSave() - Parent now handles the atomic DB save
        }
    }, [clearTrigger])

    const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

    return (
        <div style={{ width, height, pointerEvents: pointerEvents as any }}>
            <canvas ref={canvasRef} />
        </div>
    )
}
