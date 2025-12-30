"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { AnnotationRail } from './annotation-rail'
import { Pencil, Hand, Loader2 } from 'lucide-react'

interface HorizontalMusicContainerProps {
    xmlUrl: string
}

export function HorizontalMusicContainer({ xmlUrl }: HorizontalMusicContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

    // State
    const [isLoaded, setIsLoaded] = useState(false)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [isDrawing, setIsDrawing] = useState(false) // Toggle between Scroll/Draw

    // 1. Initialize & Render the FULL Song
    useEffect(() => {
        if (!containerRef.current) return

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false, // We handle width manually
            backend: "svg",
            drawingParameters: "compacttight",
            drawTitle: false,
            drawSubtitle: false,
            drawComposer: false,
            // THE KEY: Render as one massive horizontal line
            renderSingleHorizontalStaffline: true
        })

        osmdRef.current = osmd

        async function load() {
            try {
                await osmd.load(xmlUrl)
                osmd.render()

                // 2. Capture the Dimensions AFTER render
                // We need exact pixels to tell the Annotation Rail how big to be
                const sheet = osmd.GraphicSheet
                const unitInPixels = (sheet as any).UnitInPixels || 10

                // Calculate total width based on the last measure's position
                const lastMeasure = sheet.MeasureList[sheet.MeasureList.length - 1][0]
                const width = (lastMeasure.PositionAndShape.AbsolutePosition.x +
                    lastMeasure.PositionAndShape.BorderRight) * unitInPixels

                // Get height from the container (OSMD fills it)
                const height = containerRef.current?.scrollHeight || 400

                setDimensions({ width, height })
                setIsLoaded(true)

            } catch (e) {
                console.error("OSMD Render Error:", e)
            }
        }

        load()

        return () => osmd.clear()
    }, [xmlUrl])

    return (
        <div className="flex flex-col h-full bg-zinc-900">

            {/* --- TOOLBAR --- */}
            <div className="h-12 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between">
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsDrawing(false)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!isDrawing ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <Hand className="w-4 h-4" /> Scroll
                    </button>
                    <button
                        onClick={() => setIsDrawing(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isDrawing ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <Pencil className="w-4 h-4" /> Annotate
                    </button>
                </div>

                {!isLoaded && <div className="flex items-center gap-2 text-zinc-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Loading Score...</div>}
            </div>

            {/* --- SCROLL AREA --- */}
            {/* touch-none prevents scrolling on mobile ONLY when drawing is active */}
            <div className={`flex-1 overflow-x-auto overflow-y-hidden relative bg-white ${isDrawing ? 'touch-none' : ''}`}>

                {/* The Wrapper (Holds Music + Rail) */}
                <div
                    style={{
                        width: isLoaded ? dimensions.width + 100 : '100%', // +100px padding 
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    {/* LAYER 1: The Music (SVG) */}
                    {/* We force a minimum height to ensure drums fit */}
                    <div ref={containerRef} className="absolute inset-0 h-full min-h-[600px]" />

                    {/* LAYER 2: The Annotation Rail (Canvases) */}
                    {isLoaded && (
                        <div className={isDrawing ? "pointer-events-auto" : "pointer-events-none"}>
                            <AnnotationRail
                                totalWidth={dimensions.width + 100}
                                height={dimensions.height}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
