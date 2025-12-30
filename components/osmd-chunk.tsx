"use client"
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

interface OSMDChunkProps {
    xmlUrl: string
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

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false,
            backend: "svg",
            drawingParameters: "compacttight", // Keeps notes close

            // 1. HIDE EVERYTHING by default
            drawTitle: false,
            drawSubtitle: false,
            drawComposer: false,
            drawCredits: false,
            drawPartNames: isFirstChunk, // Only show "Piano" on the very first block
            drawMetronomeMarks: isFirstChunk,
        })

        osmdRef.current = osmd

        // 2. THE "STRAITJACKET" (Force alignments)
        osmd.setOptions({
            renderSingleHorizontalStaffline: true,
        })

        // Rules that apply to EVERYONE (to ensure vertical alignment matches)
        osmd.EngravingRules.PageTopMargin = 2; // Hardcode top margin so they align
        osmd.EngravingRules.PageBottomMargin = 2;
        osmd.EngravingRules.PageLeftMargin = 0;
        osmd.EngravingRules.PageRightMargin = 0;
        osmd.EngravingRules.SystemLeftMargin = 0;
        osmd.EngravingRules.SystemRightMargin = 0;

        // 3. THE "INVISIBLE SEAM" (Hide start-of-line clutter for chunks 2, 3, 4...)
        if (!isFirstChunk) {
            // Hide Clefs, Keys, Time Signatures
            osmd.EngravingRules.RenderClefsAtBeginningOfStaffline = false;
            osmd.EngravingRules.RenderKeySignatures = false;
            osmd.EngravingRules.RenderTimeSignatures = false;

            // Hide the "Squiggly Thing" (System Bracket/Brace)
            osmd.EngravingRules.RenderSystemStartLines = false; // <--- THIS FIXES THE SQUIGGLE

            // Hide Part Names (again, to be safe)
            osmd.EngravingRules.RenderPartNames = false;
        }

        // 4. Load & Slice
        osmd.load(xmlUrl).then(() => {
            osmd.setOptions({
                drawFromMeasureNumber: startMeasure,
                drawUpToMeasureNumber: endMeasure,
            })
            osmd.render()
        }).catch(err => {
            console.error("OSMD Chunk Error:", err)
            setDebugError(err.message)
        })

        return () => osmd.clear()
    }, [xmlUrl, startMeasure, endMeasure, width, isFirstChunk])

    return (
        <div
            // 5. FIX THE HEIGHT (Cut-off Drums)
            // Instead of fixed '400px', use '100%' so it fills the parent container.
            // The parent container (in horizontal-chunked-follower) will control the height.
            style={{ width: width, height: '100%', position: 'relative', overflow: 'hidden' }}
            // Remove border-dashed to make it look seamless
            className="bg-white"
        >
            {debugError ? (
                <div className="text-red-500 p-4 text-xs">Error: {debugError}</div>
            ) : (
                <div ref={containerRef} className="w-full h-full" />
            )}

            {/* Optional: Debug Marker (Toggle visibility as needed) */}
            {/* <div className="absolute top-0 right-0 bg-yellow-200/50 text-[10px] pointer-events-none">
        {startMeasure}-{endMeasure}
      </div> */}
        </div>
    )
}
