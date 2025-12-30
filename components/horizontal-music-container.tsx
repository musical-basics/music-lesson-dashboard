"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { AnnotationRail } from './annotation-rail'
import { Pencil, Hand, Loader2, Eraser, Trash2 } from 'lucide-react'

interface HorizontalMusicContainerProps {
    xmlUrl: string
    songId: string
}

export function HorizontalMusicContainer({ xmlUrl, songId }: HorizontalMusicContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

    const [isLoaded, setIsLoaded] = useState(false)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [activeTool, setActiveTool] = useState<'scroll' | 'pen' | 'eraser'>('scroll')
    const [clearTrigger, setClearTrigger] = useState(0)

    // 1. OSMD Render Logic
    useEffect(() => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = '' // Clear previous renders (Fixes "Duplicate" bug)

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false, backend: "svg", drawingParameters: "compacttight",
            drawTitle: false, drawSubtitle: false, drawComposer: false,
            renderSingleHorizontalStaffline: true
        })
        osmdRef.current = osmd

        async function load() {
            try {
                await osmd.load(xmlUrl)
                osmd.render()
                const sheet = osmd.GraphicSheet
                const unitInPixels = (sheet as any).UnitInPixels || 10
                const lastMeasure = sheet.MeasureList[sheet.MeasureList.length - 1][0]
                const width = (lastMeasure.PositionAndShape.AbsolutePosition.x +
                    lastMeasure.PositionAndShape.BorderRight) * unitInPixels

                // Ensure strictly positive dimensions
                const height = Math.max(600, containerRef.current?.scrollHeight || 0)

                setDimensions({ width, height })
                setIsLoaded(true)
            } catch (e) { console.error("OSMD Render Error:", e) }
        }
        load()
        return () => osmd.clear()
    }, [xmlUrl])

    // 2. SMART SCROLL HANDLER (Magic Mouse Compatible)
    const handleWheel = (e: React.WheelEvent) => {
        if (!scrollContainerRef.current) return;

        // A. Magic Mouse / Trackpad detection
        // If the event has 'deltaX', the user is already scrolling horizontally. 
        // Let the browser handle it natively (smooth inertia).
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            return;
        }

        // B. Standard Mouse (Vertical Wheel)
        // If strictly vertical, we manually push the scrollLeft.
        if (!e.shiftKey) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
        }
    }

    // 3. Toolbar Styles
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
                {!isLoaded && <div className="flex items-center gap-2 text-zinc-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>}
            </div>

            {/* Scroll Area */}
            <div
                ref={scrollContainerRef}
                onWheel={handleWheel} // The new smart handler
                className={`flex-1 overflow-x-auto overflow-y-hidden relative bg-white ${activeTool !== 'scroll' ? 'touch-none' : ''}`}
            >
                <div style={{
                    width: isLoaded ? dimensions.width + 200 : '100%',
                    height: '100%',
                    position: 'relative'
                }}>
                    <div ref={containerRef} className="absolute inset-0 h-full min-h-[600px]" />
                    {isLoaded && (
                        <AnnotationRail
                            totalWidth={dimensions.width + 200}
                            height={dimensions.height}
                            activeTool={activeTool}
                            clearTrigger={clearTrigger}
                            songId={songId}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
