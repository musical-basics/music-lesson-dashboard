import React from 'react'
import { Button } from "@/components/ui/button"
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save } from "lucide-react"
import { NudgeOffsets } from "@/hooks/use-svg-nudge"

interface SvgMeasureInspectorProps {
    measureNumber: number | null
    elements: { selector: string; text: string }[]
    offsets: NudgeOffsets
    onClose: () => void
    onNudge: (selector: string, axis: 'x' | 'y', delta: number) => void
    onSave: () => void
}

export function SvgMeasureInspector({ measureNumber, elements, offsets, onClose, onNudge, onSave }: SvgMeasureInspectorProps) {
    if (measureNumber === null) return null

    return (
        <div className="absolute right-0 top-14 bottom-0 w-72 bg-zinc-900/95 backdrop-blur border-l border-zinc-700 p-4 overflow-y-auto z-50 shadow-2xl transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white">SVG Nudge</h3>
                <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>

            <p className="text-xs text-zinc-500 mb-4">
                Select any text element to nudge its visual position.
            </p>

            <div className="space-y-4">
                {elements.length === 0 && <p className="text-zinc-500 text-sm">No text elements found.</p>}

                {elements.map((el) => {
                    const offset = offsets[el.selector] || { x: 0, y: 0 }
                    return (
                        <div key={el.selector} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                            <div className="flex justify-between mb-2 items-center">
                                <span className="text-xs font-bold text-zinc-400 uppercase">Text</span>
                                <span className="text-sm font-mono text-white truncate max-w-[120px]" title={el.text}>{el.text}</span>
                            </div>

                            <div className="text-[10px] text-zinc-600 mb-2">
                                Offset: ({offset.x.toFixed(0)}, {offset.y.toFixed(0)})
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Y Axis Control */}
                                <div className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1">
                                    <span className="text-[10px] text-zinc-500">Y</span>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={() => onNudge(el.selector, 'y', -5)}>
                                            <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={() => onNudge(el.selector, 'y', 5)}>
                                            <ArrowDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* X Axis Control */}
                                <div className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1">
                                    <span className="text-[10px] text-zinc-500">X</span>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={() => onNudge(el.selector, 'x', -5)}>
                                            <ArrowLeft className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={() => onNudge(el.selector, 'x', 5)}>
                                            <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800 bg-zinc-900/95 sticky bottom-0 -mx-4 px-4 pb-4">
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={onSave} disabled={elements.length === 0}>
                    <Save className="w-4 h-4" /> Save Offsets
                </Button>
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                    Offsets are saved to the database.
                </p>
            </div>
        </div>
    )
}
