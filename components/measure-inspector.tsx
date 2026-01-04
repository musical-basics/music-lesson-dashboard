import React, { useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save } from "lucide-react"

interface MeasureInspectorProps {
    measureNumber: number | null
    xmlString: string
    onClose: () => void
    onNudge: (measureNum: number, elemIndex: number, axis: 'x' | 'y', delta: number) => void
    onSave: () => void
}

export function MeasureInspector({ measureNumber, xmlString, onClose, onNudge, onSave }: MeasureInspectorProps) {
    if (measureNumber === null) return null

    // Parse the XML *just for this view* to list elements
    const elements = useMemo(() => {
        if (!xmlString) return []
        const parser = new DOMParser()
        const doc = parser.parseFromString(xmlString, "text/xml")
        const measures = doc.getElementsByTagName("measure")
        const targetMeasure = measures[measureNumber - 1]
        if (!targetMeasure) return []

        const directions = Array.from(targetMeasure.getElementsByTagName("direction"))
        return directions.map((dir, index) => {
            const words = dir.getElementsByTagName("words")[0]
            const dynamics = dir.getElementsByTagName("dynamics")[0]
            const wedge = dir.getElementsByTagName("wedge")[0]

            let label = "Unknown Element"
            let value = ""
            let type = "unknown"

            if (words) {
                label = "Text"
                value = words.textContent || ""
                type = "words"
            } else if (dynamics) {
                label = "Dynamic"
                value = dynamics.firstElementChild?.tagName || ""
                type = "dynamics"
            } else if (wedge) {
                label = "Wedge"
                value = wedge.getAttribute("type") || ""
                type = "wedge"
            }

            return { index, label, value, type }
        })
    }, [xmlString, measureNumber])

    return (
        <div className="absolute right-0 top-14 bottom-0 w-72 bg-zinc-900/95 backdrop-blur border-l border-zinc-700 p-4 overflow-y-auto z-50 shadow-2xl transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white">Measure {measureNumber}</h3>
                <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>

            <div className="space-y-6">
                {elements.length === 0 && <p className="text-zinc-500 text-sm">No editable elements found in this measure.</p>}

                {elements.map((el) => (
                    <div key={el.index} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        <div className="flex justify-between mb-2 items-center">
                            <span className="text-xs font-bold text-zinc-400 uppercase">{el.label}</span>
                            <span className="text-sm font-mono text-white truncate max-w-[120px]" title={el.value}>{el.value}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Y Axis Control */}
                            <div className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1">
                                <span className="text-[10px] text-zinc-500">Y</span>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                        onClick={() => onNudge(measureNumber, el.index, 'y', -5)}>
                                        <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                        onClick={() => onNudge(measureNumber, el.index, 'y', 5)}>
                                        <ArrowDown className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* X Axis Control */}
                            <div className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1">
                                <span className="text-[10px] text-zinc-500">X</span>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                        onClick={() => onNudge(measureNumber, el.index, 'x', -5)}>
                                        <ArrowLeft className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                        onClick={() => onNudge(measureNumber, el.index, 'x', 5)}>
                                        <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-zinc-600 pl-1">
                            Use Y arrows to move Up (negative) / Down (positive)
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800 bg-zinc-900/95 sticky bottom-0 -mx-4 px-4 pb-4">
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={onSave} disabled={elements.length === 0}>
                    <Save className="w-4 h-4" /> Save Positioning
                </Button>
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                    This will permanently update the MusicXML file.
                </p>
            </div>
        </div>
    )
}
