"use client"
import { OSMDChunk } from "@/components/osmd-chunk"

export default function TestPage() {
    // Use the uploaded XML file
    const TEST_XML = "/xmls/La Campanella Remix v8.musicxml"

    return (
        <div className="p-10 bg-gray-100 min-h-screen space-y-8">
            <h1 className="text-2xl font-bold text-black">Phase 1 Test: The Slicer</h1>
            <p className="text-gray-600">Testing with: {TEST_XML}</p>

            <div className="flex gap-4 overflow-x-auto pb-4">

                {/* Chunk 1: Measures 1-4 */}
                <div>
                    <p className="mb-2 font-bold text-black">Chunk 1 (Start)</p>
                    <OSMDChunk
                        xmlUrl={TEST_XML}
                        startMeasure={1}
                        endMeasure={4}
                        width={600}
                        isFirstChunk={true}
                    />
                </div>

                {/* Chunk 2: Measures 5-8 */}
                <div>
                    <p className="mb-2 font-bold text-black">Chunk 2 (Continuation)</p>
                    <OSMDChunk
                        xmlUrl={TEST_XML}
                        startMeasure={5}
                        endMeasure={8}
                        width={600}
                        isFirstChunk={false}
                    />
                </div>

            </div>
        </div>
    )
}
