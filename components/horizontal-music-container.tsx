"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { AnnotationRail } from './annotation-rail'
import { Pencil, Hand, Loader2, Eraser, Trash2 } from 'lucide-react' // Added Eraser/Trash icons

interface HorizontalMusicContainerProps {
    xmlUrl: string
}

export function HorizontalMusicContainer({ xmlUrl }: HorizontalMusicContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

    const [isLoaded, setIsLoaded] = useState(false)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

    // TOOL STATE
    const [activeTool, setActiveTool] = useState<'scroll' | 'pen' | 'eraser'>('scroll')
    const [clearTrigger, setClearTrigger] = useState(0)

    // ... (Keep your existing useEffect for OSMD Loading exactly as it was) ...
    // (Paste the useEffect code from the previous working version here)
    useEffect(() => {
        if (!containerRef.current) return
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
                const height = containerRef.current?.scrollHeight || 400
                setDimensions({ width, height })
                setIsLoaded(true)
            } catch (e) { console.error("OSMD Render Error:", e) }
        }
        load()
        return () => osmd.clear()
    }, [xmlUrl])


    // Helper for button styling
    const getBtnClass = (toolName: string) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTool === toolName
            ? 'bg-indigo-600 text-white'
            : 'text-zinc-400 hover:bg-zinc-700'
        }`

    return (
        <div className="flex flex-col h-full bg-zinc-900">

            {/* --- TOOLBAR --- */}
            <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between">
                <div className="flex gap-2">

                    {/* Scroll Tool */}
                    <button onClick={() => setActiveTool('scroll')} className={getBtnClass('scroll')}>
                        <Hand className="w-4 h-4" /> Scroll
                    </button>

                    {/* Pen Tool */}
                    <button onClick={() => setActiveTool('pen')} className={getBtnClass('pen')}>
                        <Pencil className="w-4 h-4" /> Annotate
                    </button>

                    {/* Eraser Tool */}
                    <button onClick={() => setActiveTool('eraser')} className={getBtnClass('eraser')}>
                        <Eraser className="w-4 h-4" /> Eraser
                    </button>

                    <div className="w-px h-6 bg-zinc-700 mx-2" /> {/* Divider */}

                    {/* Clear All */}
                    <button
                        onClick={() => {
                            if (confirm("Clear all annotations?")) setClearTrigger(prev => prev + 1)
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> Clear All
                    </button>

                </div>

                {!isLoaded && <div className="flex items-center gap-2 text-zinc-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Loading Score...</div>}
            </div>

            {/* --- SCROLL AREA --- */}
            <div className={`flex-1 overflow-x-auto overflow-y-hidden relative bg-white ${activeTool !== 'scroll' ? 'touch-none' : ''}`}>

                <div style={{
                    width: isLoaded ? dimensions.width + 100 : '100%',
                    height: '100%',
                    position: 'relative'
                }}>

                    {/* LAYER 1: The Music */}
                    <div ref={containerRef} className="absolute inset-0 h-full min-h-[600px]" />

                    {/* LAYER 2: The Annotation Rail */}
                    {isLoaded && (
                        <AnnotationRail
                            totalWidth={dimensions.width + 100}
                            height={dimensions.height}
                            activeTool={activeTool}     // Pass the tool
                            clearTrigger={clearTrigger} // Pass the clear signal
                        />
                    )}
                </div>

            </div>
        </div>
    )
}
