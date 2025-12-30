
"use client"
import { HorizontalChunkedFollower } from "@/components/horizontal-chunked-follower"

export default function TestPage() {
    // Use the uploaded XML file
    const TEST_XML = "/xmls/La Campanella Remix v8.musicxml"

    return (
        <div className="bg-gray-100 min-h-screen">
            <div className="p-4 bg-white shadow mb-4">
                <h1 className="text-xl font-bold text-black">Phase 2 Test: The Train (Seamless Scroll)</h1>
                <p className="text-sm text-gray-500">File: {TEST_XML}</p>
            </div>

            {/* Container for the infinite scroll */}
            <div className="h-[500px] border-y border-gray-300">
                <HorizontalChunkedFollower
                    xmlUrl={TEST_XML}
                />
            </div>
        </div>
    )
}

