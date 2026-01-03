"use client"
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Canvas, PencilBrush, IText } from 'fabric'

export type AnnotationRailData = Record<string, any>

export interface AnnotationRailHandle {
    addText: (globalX: number, y: number, style: { color: string, fontSize: number }) => void
    updateActiveObject: (style: any) => void
    deleteActiveObject: () => void
}

interface AnnotationRailProps {
    totalWidth: number
    height: number
    activeTool: 'scroll' | 'select' | 'pen' | 'eraser' | 'text' | null
    clearTrigger: number
    data: AnnotationRailData
    onSave: (newData: AnnotationRailData) => void
    color: string
    textSize?: number
}

const CHUNK_SIZE = 2000;

export const AnnotationRail = forwardRef<AnnotationRailHandle, AnnotationRailProps>(
    ({ totalWidth, height, activeTool, clearTrigger, data, onSave, color, textSize = 20 }, ref) => {
        const chunkCount = Math.ceil(totalWidth / CHUNK_SIZE);
        const chunkRefs = useRef<(AnnotationChunkHandle | null)[]>([]);

        const handleChunkSave = (index: number, chunkData: any) => {
            onSave({
                ...data,
                [index]: chunkData
            })
        }

        // Expose method to Parent
        useImperativeHandle(ref, () => ({
            addText: (globalX, y, style) => {
                const chunkIndex = Math.floor(globalX / CHUNK_SIZE)
                const localX = globalX % CHUNK_SIZE

                const targetChunk = chunkRefs.current[chunkIndex]
                if (targetChunk) {
                    targetChunk.addText(localX, y, style)
                }
            },
            updateActiveObject: (style) => {
                // Broadcast style update to all chunks (only the one with active obj will react)
                chunkRefs.current.forEach(chunk => chunk?.updateActiveObject(style))
            },
            deleteActiveObject: () => {
                chunkRefs.current.forEach(chunk => chunk?.deleteActiveObject())
            }
        }))

        // Global Keyboard Delete Listener
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                // Don't delete if we are in an input/textarea
                const target = e.target as HTMLElement
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

                if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Tell all chunks to check for active object and delete if not editing
                    chunkRefs.current.forEach(chunk => chunk?.deleteActiveObject())
                }
            }
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }, [])

        // ATOMIC CLEAR: Parent saves ONCE for everyone
        useEffect(() => {
            if (clearTrigger > 0) {
                onSave({})
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [clearTrigger])

        return (
            <div
                className="absolute top-0 left-0 z-10 flex"
                style={{ width: totalWidth, height: height }}
            >
                {Array.from({ length: chunkCount }).map((_, i) => (
                    <AnnotationChunk
                        key={`${i}-${Object.keys(data[i] || {}).length}`}
                        ref={(el) => { chunkRefs.current[i] = el }}
                        index={i}
                        width={i === chunkCount - 1 ? totalWidth % CHUNK_SIZE : CHUNK_SIZE}
                        height={height}
                        activeTool={activeTool}
                        clearTrigger={clearTrigger}
                        initialData={data[i]}
                        onSave={(chunkData: any) => handleChunkSave(i, chunkData)}
                        color={color}
                        textSize={textSize}
                    />
                ))}
            </div>
        )
    }
)
AnnotationRail.displayName = "AnnotationRail"

interface AnnotationChunkHandle {
    addText: (x: number, y: number, style: { color: string, fontSize: number }) => void
    updateActiveObject: (style: any) => void
    deleteActiveObject: () => void
}

const AnnotationChunk = forwardRef<AnnotationChunkHandle, any>(
    ({ width, height, index, activeTool, clearTrigger, initialData, onSave, color, textSize }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null)
        const fabricRef = useRef<Canvas | null>(null)
        const isMounted = useRef(true)

        useImperativeHandle(ref, () => ({
            addText: (x, y, style) => {
                const canvas = fabricRef.current
                if (!canvas) return

                const text = new IText('Text', {
                    left: x,
                    top: y,
                    fontFamily: 'Arial',
                    fill: style.color,
                    fontSize: style.fontSize,
                    selectable: true,
                    editable: true,
                    originX: 'center',
                    originY: 'center'
                })

                canvas.add(text)
                canvas.setActiveObject(text)
                text.enterEditing()
                text.selectAll()
                canvas.requestRenderAll()
                onSave(canvas.toJSON())
            },
            updateActiveObject: (style) => {
                const canvas = fabricRef.current
                if (!canvas) return

                const activeObj = canvas.getActiveObject() as IText
                if (activeObj) {
                    activeObj.set(style)
                    canvas.requestRenderAll()
                    onSave(canvas.toJSON())
                }
            },
            deleteActiveObject: () => {
                const canvas = fabricRef.current
                if (!canvas) return
                const activeObj = canvas.getActiveObject()
                // Only delete if NOT editing (so backspace works inside text)
                if (activeObj && !(activeObj as any).isEditing) {
                    canvas.remove(activeObj)
                    canvas.requestRenderAll()
                    onSave(canvas.toJSON())
                }
            }
        }))

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

            // --- EVENT LISTENERS ---
            const saveHandler = () => { if (isMounted.current) onSave(canvas.toJSON()) }
            canvas.on('path:created', saveHandler)
            canvas.on('object:modified', saveHandler)
            canvas.on('text:editing:exited', (opt) => {
                const target = opt.target as IText
                if (target && target.text?.trim() === '') {
                    canvas.remove(target)
                    canvas.requestRenderAll()
                }
                saveHandler()
            })

            fabricRef.current = canvas

            return () => {
                isMounted.current = false
                try { canvas.dispose() } catch (e) { }
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [width, height])

        // 2. REACTIVE DATA LOADER
        useEffect(() => {
            if (!fabricRef.current) return;
            const canvas = fabricRef.current;

            if (initialData && Object.keys(initialData).length > 0) {
                try {
                    canvas.loadFromJSON(initialData, () => {
                        if (isMounted.current) {
                            const isInteracting = !activeTool || activeTool === 'scroll' || activeTool === 'text'
                            canvas.forEachObject(o => {
                                o.selectable = isInteracting
                                o.evented = isInteracting || activeTool === 'eraser'
                            })
                            canvas.requestRenderAll()
                        }
                    })
                } catch (e) { console.error("Error loading chunk", e) }
            } else {
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
                canvas.selection = false
                canvas.defaultCursor = 'crosshair'
                canvas.hoverCursor = 'crosshair'
                canvas.forEachObject(o => { o.selectable = false; o.evented = false })
                canvas.off('mouse:down')
                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = color || "#ff0000"
                }
            } else if (activeTool === 'eraser') {
                canvas.isDrawingMode = false
                canvas.selection = false
                canvas.defaultCursor = 'cell'
                canvas.hoverCursor = 'cell'
                canvas.forEachObject(o => { o.selectable = false; o.evented = true })

                canvas.off('mouse:down');
                canvas.on('mouse:down', (opt) => {
                    if (opt.target) {
                        canvas.remove(opt.target)
                        canvas.requestRenderAll()
                        onSave(canvas.toJSON())
                    }
                })
            } else if (activeTool === 'text') {
                canvas.isDrawingMode = false
                canvas.selection = true
                canvas.defaultCursor = 'text'
                canvas.hoverCursor = 'text'
                canvas.forEachObject(o => { o.selectable = true; o.evented = true })

                canvas.off('mouse:down')
                canvas.on('mouse:down', (opt) => {
                    if (opt.target) return
                    const pointer = (canvas as any).getPointer(opt.e)
                    const text = new IText('Text', {
                        left: pointer.x,
                        top: pointer.y,
                        fontFamily: 'Arial',
                        fill: color,
                        fontSize: textSize,
                        selectable: true,
                        editable: true,
                        originX: 'center',
                        originY: 'center'
                    })
                    canvas.add(text)
                    canvas.setActiveObject(text)
                    text.enterEditing()
                    text.selectAll()
                    canvas.requestRenderAll()
                })
            } else {
                canvas.isDrawingMode = false
                canvas.selection = true
                canvas.defaultCursor = 'default'
                canvas.hoverCursor = 'move'
                canvas.forEachObject(o => { o.selectable = true; o.evented = true })
                canvas.off('mouse:down')
            }
            canvas.requestRenderAll()
        }, [activeTool, color, onSave, textSize])

        // 4. VISUAL CLEAR
        useEffect(() => {
            if (clearTrigger > 0 && fabricRef.current) {
                fabricRef.current.clear()
                fabricRef.current.backgroundColor = 'transparent'
                fabricRef.current.requestRenderAll()
            }
        }, [clearTrigger])

        const pointerEvents = activeTool === 'scroll' ? 'none' : 'auto'

        return (
            <div style={{ width, height, pointerEvents: pointerEvents as any }}>
                <canvas ref={canvasRef} />
            </div>
        )
    }
)
AnnotationChunk.displayName = "AnnotationChunk"
