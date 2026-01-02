"use client"
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { AnnotationRail, AnnotationRailHandle } from './annotation-rail'
import { Pencil, Hand, Loader2, Eraser, Trash2, Cloud } from 'lucide-react'
import { useLessonState } from '@/hooks/use-lesson-state'

export interface HorizontalMusicContainerHandle {
    undo: () => void;
    redo: () => void;
    addText: (style: { color: string, fontSize: number }) => void;
    updateActiveObject: (style: any) => void;
    deleteActiveObject: () => void;
}

interface HorizontalMusicContainerProps {
    xmlUrl: string
    songId: string
    studentId: string
    externalTool?: 'scroll'
    activeTool: 'scroll' | 'select' | 'pen' | 'eraser' | 'text' | null
    externalColor?: string
    externalTextSize?: number
    hideToolbar?: boolean
}

type BookmarkData = {
    measureNumber: number;
    pixelX: number;
}

export const HorizontalMusicContainer = forwardRef<HorizontalMusicContainerHandle, HorizontalMusicContainerProps>(
    ({ xmlUrl, songId, studentId, externalTool, externalColor, externalTextSize, hideToolbar }, ref) => {

        const containerRef = useRef<HTMLDivElement>(null)
        const scrollContainerRef = useRef<HTMLDivElement>(null)
        const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
        const railRef = useRef<AnnotationRailHandle>(null)

        const [isLoaded, setIsLoaded] = useState(false)
        const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
        const [internalTool, setInternalTool] = useState<'scroll' | 'select' | 'pen' | 'eraser'>('scroll')

        const activeTool = externalTool || internalTool
        const activeColor = externalColor || "#ff0000"
        const activeTextSize = externalTextSize || 20

        const [clearTrigger, setClearTrigger] = useState(0)
        const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])

        const { data, saveData, isLoaded: isStateLoaded } = useLessonState(studentId, songId)

        const dataRef = useRef(data)
        useEffect(() => { dataRef.current = data }, [data])

        // ----------------------------------------------------------------
        // 1. ROBUST HISTORY SYSTEM
        // ----------------------------------------------------------------
        const historyRef = useRef<any[]>([])
        const historyIndexRef = useRef<number>(-1)

        // Flag to prevent history updates during undo/redo
        const isUndoingRef = useRef(false)

        // Initialize History
        useEffect(() => {
            if (isStateLoaded && historyRef.current.length === 0 && data) {
                historyRef.current = [data]
                historyIndexRef.current = 0
                console.log("📚 History initialized with", historyRef.current.length, "items")
            }
        }, [isStateLoaded, data])

        useImperativeHandle(ref, () => ({
            undo: () => {
                if (historyIndexRef.current > 0) {
                    // Set flag to prevent handleAnnotationSave from adding to history
                    isUndoingRef.current = true

                    historyIndexRef.current -= 1
                    const previousState = historyRef.current[historyIndexRef.current]
                    console.log("↺ Undo to step", historyIndexRef.current, "of", historyRef.current.length - 1)

                    saveData({
                        ...previousState,
                        scrollX: dataRef.current?.scrollX || 0
                    })

                    // Reset flag after a short delay
                    setTimeout(() => { isUndoingRef.current = false }, 500)
                } else {
                    console.log("↺ Cannot undo - already at oldest state")
                }
            },
            redo: () => {
                if (historyIndexRef.current < historyRef.current.length - 1) {
                    // Set flag to prevent handleAnnotationSave from adding to history
                    isUndoingRef.current = true

                    historyIndexRef.current += 1
                    const nextState = historyRef.current[historyIndexRef.current]
                    console.log("↻ Redo to step", historyIndexRef.current, "of", historyRef.current.length - 1)

                    saveData({
                        ...nextState,
                        scrollX: dataRef.current?.scrollX || 0
                    })

                    // Reset flag after a short delay
                    setTimeout(() => { isUndoingRef.current = false }, 500)
                } else {
                    console.log("↻ Cannot redo - already at newest state")
                }
            },
            addText: (style: { color: string, fontSize: number }) => {
                if (!scrollContainerRef.current || !railRef.current) return

                const container = scrollContainerRef.current
                const visibleWidth = container.clientWidth
                const scrollX = container.scrollLeft

                const centerX = scrollX + (visibleWidth / 2)
                const centerY = dimensions.height > 0 ? dimensions.height / 2 : 150

                railRef.current.addText(centerX, centerY, style)
            },
            updateActiveObject: (style: any) => {
                if (railRef.current) {
                    railRef.current.updateActiveObject(style)
                }
            },
            deleteActiveObject: () => {
                if (railRef.current) {
                    railRef.current.deleteActiveObject()
                }
            }
        }))

        // ----------------------------------------------------------------
        // 2. SAVE HANDLERS
        // ----------------------------------------------------------------
        const handleAnnotationSave = (newData: any) => {
            // Skip if we're in the middle of an undo/redo
            if (isUndoingRef.current) {
                console.log("🚫 Skipping history update (undo/redo in progress)")
                return
            }

            // 1. Save to DB (UI Update)
            const payload = {
                ...newData,
                scrollX: dataRef.current?.scrollX || 0
            }
            saveData(payload)

            // 2. Add to History
            const currentIndex = historyIndexRef.current
            const currentTip = historyRef.current[currentIndex]

            // Check if this is actually new content
            const newDataStr = JSON.stringify(newData)
            const currentTipStr = JSON.stringify(currentTip)

            if (newDataStr !== currentTipStr) {
                // Slice history if we undid and are now branching off
                const newHistory = historyRef.current.slice(0, currentIndex + 1)
                newHistory.push(newData)

                // Limit memory to 20 steps
                if (newHistory.length > 20) {
                    newHistory.shift()
                }

                historyRef.current = newHistory
                historyIndexRef.current = newHistory.length - 1

                console.log("📝 History updated: now at step", historyIndexRef.current, "of", newHistory.length - 1)
            }
        }

        // ----------------------------------------------------------------
        // 3. SCROLL SYNC LOGIC
        // ----------------------------------------------------------------
        useEffect(() => {
            if (hideToolbar && data?.scrollX !== undefined && scrollContainerRef.current) {
                const currentScroll = scrollContainerRef.current.scrollLeft
                const targetScroll = data.scrollX
                if (Math.abs(currentScroll - targetScroll) > 10) {
                    scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' })
                }
            }
        }, [data?.scrollX, hideToolbar])

        const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
        const handleContainerScroll = () => {
            if (hideToolbar || !scrollContainerRef.current) return
            const x = scrollContainerRef.current.scrollLeft
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
            scrollTimeout.current = setTimeout(() => {
                saveData({ ...(dataRef.current || {}), scrollX: x })
            }, 500)
        }

        // ----------------------------------------------------------------
        // 4. OSMD LOADING
        // ----------------------------------------------------------------
        useEffect(() => {
            if (!containerRef.current) return
            let isCancelled = false
            setIsLoaded(false)
            setBookmarks([])
            containerRef.current.innerHTML = ''
            const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                autoResize: false, backend: "svg", drawingParameters: "default",
                drawTitle: false, drawSubtitle: false, drawComposer: false,
                renderSingleHorizontalStaffline: true
            })
            osmd.EngravingRules.PageTopMargin = 10.0
            osmd.EngravingRules.PageBottomMargin = 10.0
            osmd.EngravingRules.StaffDistance = 4.0
            osmdRef.current = osmd

            async function load() {
                try {
                    await osmd.load(xmlUrl)
                    if (isCancelled) return
                    osmd.render()
                    const sheet = osmd.GraphicSheet
                    const unitInPixels = (sheet as any).UnitInPixels || 10
                    const lastMeasure = sheet.MeasureList[sheet.MeasureList.length - 1][0]
                    const width = (lastMeasure.PositionAndShape.AbsolutePosition.x +
                        lastMeasure.PositionAndShape.BorderRight) * unitInPixels

                    let height = 300
                    const svgElement = containerRef.current?.querySelector('svg')
                    if (svgElement) height = svgElement.getBoundingClientRect().height
                    height += 50
                    setDimensions({ width, height })

                    try {
                        const newBookmarks: BookmarkData[] = []
                        for (let i = 0; i < sheet.MeasureList.length; i += 8) {
                            const column = sheet.MeasureList[i]
                            if (column && column[0]) {
                                newBookmarks.push({
                                    measureNumber: column[0].MeasureNumber,
                                    pixelX: column[0].PositionAndShape.AbsolutePosition.x * unitInPixels
                                })
                            }
                        }
                        setBookmarks(newBookmarks)
                    } catch (bmError) { console.warn("Bookmark failed", bmError) }

                } catch (e) { if (!isCancelled) console.error("OSMD Error:", e) }
                finally { if (!isCancelled) setIsLoaded(true) }
            }
            load()
            return () => { isCancelled = true; try { osmd.clear() } catch (e) { } }
        }, [xmlUrl])

        const handleWheel = (e: React.WheelEvent) => {
            if (!scrollContainerRef.current) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            if (!e.shiftKey) scrollContainerRef.current.scrollLeft += e.deltaY;
        }

        const jumpTo = (x: number) => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ left: x - 50, behavior: 'smooth' })
                if (!hideToolbar) {
                    saveData({ ...(dataRef.current || {}), scrollX: x - 50 })
                }
            }
        }

        const getBtnClass = (toolName: string) =>
            `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTool === toolName ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`

        return (
            <div className="flex flex-col h-full bg-zinc-900">
                {!hideToolbar && (
                    <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between shrink-0">
                        <div className="flex gap-2">
                            <button onClick={() => setInternalTool('scroll')} className={getBtnClass('scroll')}>
                                <Hand className="w-4 h-4" /> Scroll
                            </button>
                            <button onClick={() => setInternalTool('pen')} className={getBtnClass('pen')}>
                                <Pencil className="w-4 h-4" /> Annotate
                            </button>
                            <button onClick={() => setInternalTool('eraser')} className={getBtnClass('eraser')}>
                                <Eraser className="w-4 h-4" /> Eraser
                            </button>
                            <div className="w-px h-6 bg-zinc-700 mx-2" />
                            <button
                                onClick={() => { if (confirm("Clear all?")) setClearTrigger(p => p + 1) }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Clear All
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            {!isLoaded && (
                                <div className="flex items-center gap-2 text-indigo-400 text-xs animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Processing Score...
                                </div>
                            )}
                            <Cloud className={`w-4 h-4 ${isStateLoaded ? 'text-green-500' : 'text-zinc-600'}`} />
                        </div>
                    </div>
                )}

                <div
                    ref={scrollContainerRef}
                    onWheel={handleWheel}
                    onScroll={handleContainerScroll}
                    className={`flex-1 overflow-x-auto overflow-y-auto relative bg-zinc-900 ${activeTool !== 'scroll' ? 'touch-none' : ''}`}
                >
                    <div className="bg-white" style={{ width: isLoaded ? dimensions.width + 200 : '100%', height: isLoaded ? dimensions.height : '100%', position: 'relative' }}>
                        <div ref={containerRef} className="absolute inset-0" />
                        {isLoaded && isStateLoaded && (
                            <AnnotationRail
                                ref={railRef}
                                totalWidth={dimensions.width + 200}
                                height={dimensions.height}
                                activeTool={activeTool}
                                clearTrigger={clearTrigger}
                                data={data}
                                onSave={handleAnnotationSave}
                                color={activeColor}
                                textSize={activeTextSize}
                            />
                        )}
                    </div>
                </div>

                {isLoaded && bookmarks.length > 0 && (
                    <div className="h-10 bg-zinc-900 border-t border-zinc-800 flex items-center gap-1 px-4 overflow-x-auto shrink-0 custom-scrollbar">
                        <span className="text-zinc-500 text-xs font-semibold mr-2 uppercase tracking-wider sticky left-0 bg-zinc-900 z-10">Jump to:</span>
                        {bookmarks.map((b) => (
                            <button key={b.measureNumber} onClick={() => jumpTo(b.pixelX)} className="px-2 py-1 bg-zinc-800 hover:bg-indigo-600 text-zinc-400 hover:text-white text-xs rounded transition-colors whitespace-nowrap min-w-[3rem] border border-zinc-700 hover:border-indigo-500">
                                M. {b.measureNumber}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }
)

HorizontalMusicContainer.displayName = "HorizontalMusicContainer"
