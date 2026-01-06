import React, { useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save } from "lucide-react"
import { NudgeOffsets } from "@/hooks/use-svg-nudge"

interface SvgMeasureInspectorProps {
    measureNumber: number | null
    elements: { selector: string; text: string }[]
    offsets: NudgeOffsets
    selectedElementSelector?: string | null
    onClose: () => void
    onNudge: (selector: string, axis: 'x' | 'y', delta: number) => void
    onSave: () => void
    onSelectElement?: (selector: string | null) => void
}

export function SvgMeasureInspector({ measureNumber, elements, offsets, selectedElementSelector, onClose, onNudge, onSave, onSelectElement }: SvgMeasureInspectorProps) {
    const elementRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const containerRef = useRef<HTMLDivElement>(null)

    // Scroll to the selected element when it changes
    useEffect(() => {
        if (selectedElementSelector && elementRefs.current[selectedElementSelector]) {
            elementRefs.current[selectedElementSelector]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })
        }
    }, [selectedElementSelector])

    if (measureNumber === null) return null

    return (
        <div ref={containerRef} className="absolute right-0 top-14 bottom-0 w-72 bg-zinc-900/95 backdrop-blur border-l border-zinc-700 p-4 overflow-y-auto z-50 shadow-2xl transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white">SVG Nudge</h3>
                <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>

            <p className="text-xs text-zinc-500 mb-4">
                Click any text element on the sheet music to select it, or use the controls below.
            </p>

            <div className="space-y-4">
                {elements.length === 0 && <p className="text-zinc-500 text-sm">No text elements found.</p>}

                {elements.map((el) => {
                    const offset = offsets[el.selector] || { x: 0, y: 0 }
                    const isSelected = selectedElementSelector === el.selector
                    return (
                        <div
                            key={el.selector}
                            ref={(ref) => { elementRefs.current[el.selector] = ref }}
                            className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${isSelected
                                    ? 'bg-indigo-950 border-indigo-500 ring-2 ring-indigo-500/50'
                                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                                }`}
                            onClick={() => onSelectElement?.(isSelected ? null : el.selector)}
                        >
                            <div className="flex justify-between mb-2 items-center">
                                <span className={`text-xs font-bold uppercase ${isSelected ? 'text-indigo-400' : 'text-zinc-400'}`}>Text</span>
                                <span className={`text-sm font-mono truncate max-w-[120px] ${isSelected ? 'text-indigo-200' : 'text-white'}`} title={el.text}>{el.text}</span>
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
                                            onClick={(e) => { e.stopPropagation(); onNudge(el.selector, 'y', -5) }}>
                                            <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={(e) => { e.stopPropagation(); onNudge(el.selector, 'y', 5) }}>
                                            <ArrowDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* X Axis Control */}
                                <div className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1">
                                    <span className="text-[10px] text-zinc-500">X</span>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={(e) => { e.stopPropagation(); onNudge(el.selector, 'x', -5) }}>
                                            <ArrowLeft className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                            onClick={(e) => { e.stopPropagation(); onNudge(el.selector, 'x', 5) }}>
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

