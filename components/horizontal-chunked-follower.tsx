"use client"
import { useEffect, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { OSMDChunk } from './osmd-chunk'
import { HorizontalAnnotation } from './horizontal-annotation'

const MEASURES_PER_CHUNK = 4;
const CHUNK_WIDTH = 1000; // Pixels per chunk

export function HorizontalChunkedFollower({ xmlUrl }: { xmlUrl: string }) {
    const [totalMeasures, setTotalMeasures] = useState(0)
    const [loading, setLoading] = useState(true)

    // 1. "The Spy": Load XML once just to count measures
    useEffect(() => {
        async function countMeasures() {
            // We create a temporary, invisible helper to parse the file
            const div = document.createElement('div');
            // Hide the spy
            div.style.visibility = 'hidden';
            div.style.position = 'absolute';
            document.body.appendChild(div);

            const osmd = new OpenSheetMusicDisplay(div, {
                autoResize: false,
                backend: "svg"
            });

            try {
                await osmd.load(xmlUrl);
                // Ask OSMD: "How long is this piece?"
                // Try multiple ways to find the measure count to be safe
                const sheet = osmd.Sheet;
                const measureCount = sheet.SourceMeasures.length;

                console.log("OSMD Loaded. Measure count:", measureCount);
                setTotalMeasures(measureCount);
                setLoading(false);
            } catch (e) {
                console.error("Failed to parse score length", e);
            } finally {
                // Cleanup the spy
                if (document.body.contains(div)) {
                    document.body.removeChild(div);
                }
            }
        }
        countMeasures();
    }, [xmlUrl]);

    if (loading) return <div className="p-10 text-white">Analyzing Score...</div>

    // 2. Calculate how many chunks we need
    const chunkCount = Math.ceil(totalMeasures / MEASURES_PER_CHUNK);
    const chunks = Array.from({ length: chunkCount });

    return (
        <div className="flex flex-col h-full bg-zinc-900">
            {/* Scroll Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">

                {/* The Train Track */}
                <div className="flex h-full bg-white">
                    {chunks.map((_, index) => {
                        const start = (index * MEASURES_PER_CHUNK) + 1;
                        const end = Math.min((index + 1) * MEASURES_PER_CHUNK, totalMeasures);

                        return (
                            <div
                                key={index}
                                className="relative h-full flex-shrink-0 border-r border-gray-100"
                                style={{ width: CHUNK_WIDTH }}
                            >
                                {/* Layer 1: The Music Slice */}
                                <OSMDChunk
                                    xmlUrl={xmlUrl}
                                    startMeasure={start}
                                    endMeasure={end}
                                    width={CHUNK_WIDTH}
                                    isFirstChunk={index === 0}
                                />

                                {/* Layer 2: The Annotation Slice */}
                                {/* Each chunk gets its own drawing canvas */}
                                <HorizontalAnnotation
                                    totalWidth={CHUNK_WIDTH}
                                    height={400} // This should match OSMDChunk height
                                    chunkId={`chunk-${index}`}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
