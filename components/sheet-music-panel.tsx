"use client"
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { OpenSheetMusicDisplay as OSMDClass } from 'opensheetmusicdisplay'
import { AnnotationRail, AnnotationRailHandle } from './annotation-rail'
import { AnnotationToolbar, TextPreset, DEFAULT_PRESETS } from './annotation-toolbar'
import { Loader2, Cloud } from 'lucide-react'
import { useAnnotationHistory } from '@/hooks/use-annotation-history'
import { useIsMobile } from '@/hooks/use-mobile'

interface SheetMusicPanelProps {
    xmlUrl: string
    songId: string
    studentId: string
    isStudent?: boolean
    readOnly?: boolean
}

type BookmarkData = {
    measureNumber: number;
    pixelX: number;
}

export function SheetMusicPanel({
    xmlUrl,
    songId,
    studentId,
    isStudent = false,
    readOnly = false
}: SheetMusicPanelProps) {
    // ----------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // ----------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OSMDClass | null>(null)
    const railRef = useRef<AnnotationRailHandle>(null)

    const [isLoaded, setIsLoaded] = useState(false)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])

    const isMobile = useIsMobile()

    // Tool State
    const [activeTool, setActiveTool] = useState<'scroll' | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | null>(
        isMobile ? 'scroll' : 'select'
    )
    const [penColor, setPenColor] = useState("#ff0000") // Default Red
    const [textSize, setTextSize] = useState(20)
    const [clearTrigger, setClearTrigger] = useState(0)

    // History & Persistence Hook
    const {
        data,
        undo,
        redo,
        canUndo,
        canRedo,
        pushToHistory,
        saveData,
        isLoaded: isStateLoaded
    } = useAnnotationHistory(studentId, songId)

    // Scroll Persistence (Initial Restore)
    const hasRestoredScroll = useRef(false)
    useEffect(() => {
        if (isLoaded && isStateLoaded && data?.scrollX !== undefined && scrollContainerRef.current && !hasRestoredScroll.current) {
            console.log("📍 Panel: Restoring saved scroll position:", data.scrollX)
            scrollContainerRef.current.scrollLeft = data.scrollX
            hasRestoredScroll.current = true
        }
    }, [isLoaded, isStateLoaded, data?.scrollX])

    // Scroll Sync (Follow Mode for Student)
    useEffect(() => {
        if (isStudent && data?.scrollX !== undefined && scrollContainerRef.current) {
            const currentScroll = scrollContainerRef.current.scrollLeft
            const targetScroll = data.scrollX
            if (Math.abs(currentScroll - targetScroll) > 10) {
                scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' })
            }
        }
    }, [data?.scrollX, isStudent])

    const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
    const handleContainerScroll = () => {
        if (isStudent || !scrollContainerRef.current) return
        const x = scrollContainerRef.current.scrollLeft
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
        scrollTimeout.current = setTimeout(() => {
            saveData({ ...data, scrollX: x })
        }, 150)
    }

    // ----------------------------------------------------------------
    // 2. OSMD HANDLERS (Copied & Cleaned)
    // ----------------------------------------------------------------
    const handleWheel = (e: React.WheelEvent) => {
        if (!scrollContainerRef.current) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (!e.shiftKey) scrollContainerRef.current.scrollLeft += e.deltaY;
    }

    const jumpTo = (x: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: x - 50, behavior: 'smooth' })
            if (!isStudent) {
                saveData({ ...data, scrollX: x - 50 })
            }
        }
    }

    // ----------------------------------------------------------------
    // 3. ANNOTATION LOGIC
    // ----------------------------------------------------------------
    const handleTriggerText = () => {
        const container = scrollContainerRef.current
        if (!container || !railRef.current) return
        const visibleWidth = container.clientWidth
        const scrollX = container.scrollLeft
        const centerX = scrollX + (visibleWidth / 2)
        const centerY = dimensions.height > 0 ? dimensions.height / 2 : 150

        railRef.current.addText(centerX, centerY, { color: penColor, fontSize: textSize })
        setActiveTool('select') // Switch to select after adding text? Or stay in text mode?
    }

    const handleTextStyleChange = (style: any, skipSave = false) => {
        if (railRef.current) {
            railRef.current.updateActiveObject(style, skipSave)
        }
    }

    const handleAnnotationSave = (newData: any) => {
        // Construct payload with current scroll (to preserve it)
        const payload = {
            ...newData,
            scrollX: scrollContainerRef.current?.scrollLeft || data.scrollX || 0
        }
        pushToHistory(payload)
    }

    const clearAnnotations = () => {
        if (confirm("Clear all annotations?")) {
            setClearTrigger(p => p + 1)
            // Ideally we should also push an empty state to history?
            // AnnotationRail will call onSave with empty data when cleared? 
            // Existing logic relies on clearTrigger prop in AnnotationRail 
            // which likely triggers internal clear AND call onSave.
        }
    }

    // ----------------------------------------------------------------
    // 4. OSMD LOADING EFFECT
    // ----------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current) return
        let isCancelled = false
        setIsLoaded(false)
        setBookmarks([])
        containerRef.current.innerHTML = ''
        const options = {
            autoResize: false,
            backend: "svg",
            drawingParameters: "all",
            disableTimestampCalculation: true,
            drawTitle: false, drawSubtitle: false, drawComposer: false,
            renderSingleHorizontalStaffline: true
        }
        const osmdInstance = new OSMDClass(containerRef.current, options as any)

            // Cast to any to access internal EngravingRules properties
            (osmdInstance.EngravingRules as any).RenderAccountForSkylineBottomline = false; // Disable collision detection snapping
        osmdInstance.EngravingRules.PageTopMargin = 10.0
        osmdInstance.EngravingRules.PageBottomMargin = 10.0
        osmdInstance.EngravingRules.StaffDistance = 4.0
        osmdRef.current = osmdInstance

        async function load() {
            try {
                await osmdInstance.load(xmlUrl)
                if (isCancelled) return
                osmdInstance.render()
                const sheet = osmdInstance.GraphicSheet
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
        return () => { isCancelled = true; try { osmdInstance.clear() } catch (e) { } }
    }, [xmlUrl])


    return (
        <div className="flex flex-col h-full bg-zinc-900">
            {/* Toolbar - Teacher Only */}
            {!isStudent && (
                <div className="h-14 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between shrink-0">
                    <AnnotationToolbar
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        textSize={textSize}
                        setTextSize={setTextSize}
                        handleTriggerText={handleTriggerText}
                        handleTextStyleChange={handleTextStyleChange}
                        penColor={penColor}
                        setPenColor={setPenColor}
                        undo={undo}
                        redo={redo}
                        clearAnnotations={clearAnnotations}
                        saveAnnotations={() => { /* Auto-saves, maybe show toast? */ }}
                        isSaved={!canUndo && isLoaded} // Rough approximation
                        canUndo={canUndo}
                        canRedo={canRedo}
                    />
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

            {/* Scrollable Container */}
            <div
                ref={scrollContainerRef}
                onWheel={handleWheel}
                onScroll={handleContainerScroll}
                className={`flex-1 overflow-x-auto overflow-y-auto relative bg-zinc-900 ${(activeTool !== 'scroll' && activeTool !== null && !readOnly) ? 'touch-none' : ''}`}
            >
                <div className="bg-white" style={{ width: isLoaded ? dimensions.width + 200 : '100%', height: isLoaded ? dimensions.height : '100%', position: 'relative' }}>
                    <div ref={containerRef} className="absolute inset-0" />
                    {isLoaded && isStateLoaded && (
                        <AnnotationRail
                            ref={railRef}
                            totalWidth={dimensions.width + 200}
                            height={dimensions.height}
                            activeTool={activeTool as any}
                            clearTrigger={clearTrigger}
                            data={data}
                            onSave={handleAnnotationSave}
                            color={penColor}
                            textSize={textSize}
                            readOnly={readOnly}
                        />
                    )}
                </div>
            </div>

            {/* Bookmarks Bar */}
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
