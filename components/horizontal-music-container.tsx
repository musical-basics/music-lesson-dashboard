"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { AnnotationRail } from './annotation-rail'
import { Pencil, Hand, Loader2, Eraser, Trash2, Cloud } from 'lucide-react'
import { useLessonState } from '@/hooks/use-lesson-state'

interface HorizontalMusicContainerProps {
    xmlUrl: string
    songId: string
    studentId: string // <--- New Context
}

type BookmarkData = {
    measureNumber: number;
    pixelX: number;
}

export function HorizontalMusicContainer({ xmlUrl, songId, studentId }: HorizontalMusicContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

    const [isLoaded, setIsLoaded] = useState(false)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [activeTool, setActiveTool] = useState<'scroll' | 'pen' | 'eraser'>('scroll')
    const [clearTrigger, setClearTrigger] = useState(0)
    const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])

    // HOOK: Managed Lesson State
    const { data, saveData, isLoaded: isStateLoaded } = useLessonState(studentId, songId)

    useEffect(() => {
        if (!containerRef.current) return
        let isCancelled = false

        setIsLoaded(false)
        setBookmarks([])
        containerRef.current.innerHTML = ''

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false, backend: "svg", drawingParameters: "compacttight",
            drawTitle: false, drawSubtitle: false, drawComposer: false,
            renderSingleHorizontalStaffline: true
        })
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
                const height = Math.max(600, containerRef.current?.scrollHeight || 0)

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
        scrollContainerRef.current?.scrollTo({ left: x - 50, behavior: 'smooth' })
    }

    const getBtnClass = (toolName: string) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTool === toolName
            ? 'bg-indigo-600 text-white'
            : 'text-zinc-400 hover:bg-zinc-700'
        }`

    return (
        <div className="flex flex-col h-full bg-zinc-900">

            {/* Toolbar */}
            <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between shrink-0">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTool('scroll')} className={getBtnClass('scroll')}>
                        <Hand className="w-4 h-4" /> Scroll
                    </button>
                    <button onClick={() => setActiveTool('pen')} className={getBtnClass('pen')}>
                        <Pencil className="w-4 h-4" /> Annotate
                    </button>
                    <button onClick={() => setActiveTool('eraser')} className={getBtnClass('eraser')}>
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
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                onWheel={handleWheel}
                className={`flex-1 overflow-x-auto overflow-y-auto relative bg-white ${activeTool !== 'scroll' ? 'touch-none' : ''}`}
            >
                <div style={{ width: isLoaded ? dimensions.width + 200 : '100%', height: isLoaded ? dimensions.height : '100%', position: 'relative' }}>
                    <div ref={containerRef} className="absolute inset-0" />

                    {/* The Rail needs both the Music (isLoaded) and the Data (isStateLoaded) */}
                    {isLoaded && isStateLoaded && (
                        <AnnotationRail
                            totalWidth={dimensions.width + 200}
                            height={dimensions.height}
                            activeTool={activeTool}
                            clearTrigger={clearTrigger}
                            data={data}
                            onSave={saveData}
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
