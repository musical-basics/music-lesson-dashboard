"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

interface OSMDChunkProps {
    xmlUrl: string // URL to your XML file (or raw string content)
    startMeasure: number
    endMeasure: number
    width: number
    isFirstChunk: boolean
}

export function OSMDChunk({ xmlUrl, startMeasure, endMeasure, width, isFirstChunk }: OSMDChunkProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
    const [debugError, setDebugError] = useState<string | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // 1. Initialize OSMD
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false, // CRITICAL: We control the width manually via CSS
            backend: "svg",
            drawingParameters: "compacttight", // Fit more music in less space

            // Hiding UI elements for seamless connections
            drawPartNames: isFirstChunk,
            drawTitle: false, // We'll put the title in your app header, not the canvas
            drawSubtitle: false,
            drawComposer: false,
            drawMetronomeMarks: isFirstChunk, // Only show tempo on start

            // The "Infinite Scroll" visual hack
            // If it's NOT the first chunk, we try to hide the clef/key to look continuous
            // Note: OSMD v1.0+ handles this via render logic, but 'compacttight' helps.
        })
        osmdRef.current = osmd

        // 2. Load the file
        osmd.load(xmlUrl).then(() => {
            // 3. Slice the Music
            osmd.setOptions({
                drawFromMeasureNumber: startMeasure,
                drawUpToMeasureNumber: endMeasure,
            })

            // 4. Force specific width calculation
            // We assume ~250px per measure for readable size
            osmd.render()
        }).catch(err => {
            console.error("OSMD Chunk Error:", err)
            setDebugError(err.message)
        })

        return () => {
            osmd.clear()
        }
    }, [xmlUrl, startMeasure, endMeasure, width, isFirstChunk])

    return (
        <div
            style={{ width: width, height: 400, position: 'relative', overflow: 'hidden' }}
            className="bg-white border-r border-dashed border-gray-300"
        >
            {debugError ? (
                <div className="text-red-500 p-4 text-xs">Error: {debugError}</div>
            ) : (
                <div ref={containerRef} className="w-full h-full" />
            )}

            {/* Debug Label: Remove this before production */}
            <div className="absolute top-0 right-0 bg-yellow-200 text-xs px-1 text-black font-mono z-50 pointer-events-none">
                M {startMeasure}-{endMeasure}
            </div>
        </div>
    )
}
