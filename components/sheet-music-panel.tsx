"use client"
import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { OpenSheetMusicDisplay as OSMDClass } from 'opensheetmusicdisplay'
import { AnnotationRail, AnnotationRailHandle } from './annotation-rail'
import { AnnotationToolbar, TextPreset, DEFAULT_PRESETS } from './annotation-toolbar'
import { Loader2, Cloud } from 'lucide-react'
import { useAnnotationHistory } from '@/hooks/use-annotation-history'
import { useIsMobile } from '@/hooks/use-mobile'
import { useXmlNudge } from "@/hooks/use-xml-nudge"
import { MeasureInspector } from "@/components/measure-inspector"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

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
    const { toast } = useToast()

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

    // Nudge & Inspector State
    const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null)
    const { xmlString, setXmlString, updateElementPosition } = useXmlNudge("")

    const isMobile = useIsMobile()

    // Tool State
    const [activeTool, setActiveTool] = useState<'scroll' | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'nudge' | null>(
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
    // 4. XML & OSMD LOGIC
    // ----------------------------------------------------------------

    // Fetch initial XML
    useEffect(() => {
        if (!xmlUrl) return
        fetch(xmlUrl)
            .then(r => r.text())
            .then(text => {
                setXmlString(text)
            })
            .catch(err => console.error("Failed to fetch XML:", err))
    }, [xmlUrl, setXmlString])

    // Initialize OSMD (Once) and Handle Updates
    useEffect(() => {
        if (!containerRef.current) return

        let isCancelled = false
        // Only reset if we are purely switching songs, but here we want to persist the instance if possible?
        // Actually, for simplicity, let's keep the single effect but rely on xmlString

        // If xmlString is empty, don't do anything yet
        if (!xmlString) return

        setIsLoaded(false)
        setBookmarks([])

        // Check if OSMD is already initialized
        if (!osmdRef.current) {
            containerRef.current.innerHTML = '' // Clear only on first init
            // We need to initialize asynchronously due to dynamic import
            // But we can't block this effect. 
            // Strategy: Create a localized init function.
        }

        async function initAndLoad() {
            try {
                if (!osmdRef.current) {
                    // Dynamic import (Production Crash Fix)
                    const { OpenSheetMusicDisplay: OSMD } = await import('opensheetmusicdisplay')
                    if (isCancelled) return

                    const options = {
                        autoResize: false,
                        backend: "svg",
                        drawingParameters: "all",
                        disableTimestampCalculation: true,
                        drawTitle: false, drawSubtitle: false, drawComposer: false,
                        renderSingleHorizontalStaffline: true
                    }
                    const instance = new OSMD(containerRef.current!, options as any) as unknown as OSMDClass

                    // Apply options
                    (instance.EngravingRules as any).RenderAccountForSkylineBottomline = false;
                    instance.EngravingRules.PageTopMargin = 10.0
                    instance.EngravingRules.PageBottomMargin = 10.0
                    instance.EngravingRules.StaffDistance = 4.0

                    osmdRef.current = instance
                }

                const osmdInstance = osmdRef.current
                if (!osmdInstance) return

                await osmdInstance.load(xmlString)
                if (isCancelled) return

                osmdInstance.render()

                // --- Calculations (Bookmarks & Dimensions) ---
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

            } catch (e) {
                if (!isCancelled) console.error("OSMD Error:", e)
            } finally {
                if (!isCancelled) setIsLoaded(true)
            }
        }

        initAndLoad()

        return () => {
            // We don't necessarily want to kill the instance on every render if just string changes
            // But if unmounting, we should.
            isCancelled = true
        }

    }, [xmlString]) // Re-run when xmlString changes

    // Cleanup on unmount (separate effect to avoid clearing on nudge)
    useEffect(() => {
        return () => {
            if (osmdRef.current) {
                try { osmdRef.current.clear() } catch (e) { }
                osmdRef.current = null
            }
        }
    }, [])

    // Click Listener for Measure Selection
    useEffect(() => {
        const container = containerRef.current
        if (!container || isStudent) return

        const handleClick = (e: MouseEvent) => {
            if (!osmdRef.current) return
            // Only trigger if we are in "Nudge Mode"
            if (activeTool !== 'nudge') return

            try {
                // Get measure from click coordinates
                // Note: OSMD coordinates might be relative to svg
                const measure = (osmdRef.current.GraphicSheet as any).GetNearestMeasure(e.clientX, e.clientY)
                console.log("Clicked Measure:", measure?.MeasureNumber)
                if (measure) {
                    setSelectedMeasure(measure.MeasureNumber)
                }
            } catch (err) { console.warn("No measure found") }
        }

        // Container has the SVG.
        container.addEventListener('click', handleClick)
        return () => container.removeEventListener('click', handleClick)
    }, [isStudent, isLoaded, activeTool]) // Re-bind if activeTool changes

    // Handle Save
    const handleSaveDraft = async () => {
        if (!songId) return

        try {
            const blob = new Blob([xmlString], { type: 'text/xml' })
            const file = new File([blob], "udpated_score.musicxml", { type: "text/xml" })
            const formData = new FormData()
            formData.append('xml_file', file)
            // We use the existing API which handles R2 upload and DB update
            // We assume the user ID is handled by the API session or passed param
            // The API expects 'user_id' in body? Let's check PieceXmlEditor...
            // It sends hardcoded "teacher-1". We should stick to that pattern for now or use prop.
            // But wait, the API route uses `formData.get('user_id')`.
            formData.append('user_id', 'teacher-1') // Matching previous implementation

            const res = await fetch(`/api/pieces/${songId}`, {
                method: 'PUT',
                body: formData,
            })

            if (!res.ok) throw new Error("Failed to upload")

            toast({ title: "Saved!", description: "Score updated successfully." })
            window.location.reload()

        } catch (e) {
            toast({ title: "Error", description: "Failed to save score.", variant: "destructive" })
            console.error(e)
        }
    }

    return (
        <div className="flex flex-col h-full bg-zinc-900 relative">
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
                        <div className={`absolute inset-0 ${activeTool === 'nudge' ? 'pointer-events-none' : ''}`}>
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
                        </div>
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

            {/* Measure Inspector Overlay */}
            {!isStudent && (
                <MeasureInspector
                    measureNumber={selectedMeasure}
                    xmlString={xmlString || ""}
                    onClose={() => setSelectedMeasure(null)}
                    onNudge={updateElementPosition}
                    onSave={handleSaveDraft}
                />
            )}
        </div>
    )
}
