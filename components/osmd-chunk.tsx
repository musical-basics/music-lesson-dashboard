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

            // Standard hiding
            drawTitle: false,
            drawSubtitle: false,
            drawComposer: false,
            drawMetronomeMarks: isFirstChunk,
            drawPartNames: isFirstChunk, // Only show "Piano" on the first one
        })
        osmdRef.current = osmd

        // The Magic: Disable Clefs & Signatures for continuation chunks
        osmd.setOptions({
            renderSingleHorizontalStaffline: true, // Forces horizontal layout
        })

        if (!isFirstChunk) {
            osmd.EngravingRules.RenderClefsAtBeginningOfStaffline = false;
            osmd.EngravingRules.RenderKeySignatures = false;
            osmd.EngravingRules.RenderTimeSignatures = false;
        }

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
