import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
    MousePointer2,
    MousePointerClick,
    Pencil,
    Highlighter,
    Type,
    Settings2,
    Bold,
    Italic,
    Underline,
    Trash2,
    Plus,
    Undo2,
    Redo2,
    Save,
    Eraser,
} from "lucide-react"

export type TextPreset = {
    id: string
    name: string
    fontSize: number
    color: string
}

export const DEFAULT_PRESETS: TextPreset[] = [
    { id: 'p1', name: 'Fingerings', fontSize: 16, color: '#ef4444' }, // Red small
    { id: 'p2', name: 'Note Names', fontSize: 20, color: '#3b82f6' }, // Blue medium
    { id: 'p3', name: 'Teacher Note', fontSize: 28, color: '#f59e0b' }, // Orange large
]

const colors = [
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#3b82f6", // Blue
    "#a855f7", // Purple
    "#ffffff", // White
    "#000000", // Black
]

export interface AnnotationToolbarProps {
    activeTool: 'scroll' | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'nudge' | null
    setActiveTool: (tool: 'scroll' | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'nudge' | null) => void
    textSize: number
    setTextSize: (size: number) => void
    handleTriggerText: () => void
    handleTextStyleChange: (style: any, skipSave?: boolean) => void
    penColor: string
    setPenColor: (color: string) => void
    undo: () => void
    redo: () => void
    clearAnnotations: () => void
    saveAnnotations: () => void
    isSaved: boolean
    canUndo: boolean
    canRedo: boolean
}

export const AnnotationToolbar = ({
    activeTool,
    setActiveTool,
    textSize,
    setTextSize,
    handleTriggerText,
    handleTextStyleChange,
    penColor,
    setPenColor,
    undo,
    redo,
    clearAnnotations,
    saveAnnotations,
    isSaved,
    canUndo,
    canRedo
}: AnnotationToolbarProps) => (
    <div className="flex items-center gap-1 lg:gap-2 px-2 py-1.5 bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
        {/* Tool buttons */}
        <Button
            variant={activeTool === "select" ? "default" : "ghost"}
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => setActiveTool(activeTool === "select" ? null : "select")}
            title="Select"
        >
            <MousePointer2 className="w-4 h-4" />
        </Button>
        <Button
            variant={activeTool === "nudge" ? "default" : "ghost"}
            size="sm"
            className="w-8 h-8 p-0 text-amber-500 hover:text-amber-400"
            onClick={() => setActiveTool(activeTool === "nudge" ? null : "nudge")}
            title="Nudge Inspector (Edit XML)"
        >
            <MousePointerClick className="w-4 h-4" />
        </Button>
        <Button
            variant={activeTool === "pen" ? "default" : "ghost"}
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => setActiveTool(activeTool === "pen" ? null : "pen")}
            title="Pen"
        >
            <Pencil className="w-4 h-4" />
        </Button>
        <Button
            variant={activeTool === "highlighter" ? "default" : "ghost"}
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => setActiveTool(activeTool === "highlighter" ? null : "highlighter")}
            title="Highlighter"
        >
            <Highlighter className="w-4 h-4" />
        </Button>
        <Popover>
            <div className="flex items-center bg-zinc-800/50 rounded-md border border-zinc-700 mx-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-r-none"
                    onClick={handleTriggerText}
                    title="Add Text"
                >
                    <Type className="w-4 h-4" />
                </Button>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-6 h-8 p-0 rounded-l-none border-l border-zinc-700 hover:bg-zinc-700">
                        <Settings2 className="w-3 h-3" />
                    </Button>
                </PopoverTrigger>
            </div>
            <PopoverContent className="w-64 bg-zinc-900 border-zinc-800 p-4 space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Text Size: {textSize}px</Label>
                    <div className="flex items-center gap-3">
                        <span className="text-xs">A</span>
                        <input
                            type="range"
                            min="12"
                            max="72"
                            value={textSize}
                            onChange={(e) => {
                                const size = Number(e.target.value)
                                setTextSize(size)
                                // Visual update only, skip saving to history
                                handleTextStyleChange({ fontSize: size }, true)
                            }}
                            onPointerUp={() => {
                                // Commit the change when user releases
                                handleTextStyleChange({ fontSize: textSize }, false)
                            }}
                            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-lg">A</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Style</Label>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                            onClick={() => handleTextStyleChange({ fontWeight: 'bold' })}
                        >
                            <Bold className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                            onClick={() => handleTextStyleChange({ fontStyle: 'italic' })}
                        >
                            <Italic className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                            onClick={() => handleTextStyleChange({ underline: true })}
                        >
                            <Underline className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-red-400"
                            onClick={() => handleTextStyleChange({ fill: null })}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Presets</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {DEFAULT_PRESETS.map((preset) => (
                            <Button
                                key={preset.id}
                                variant="outline"
                                size="sm"
                                className="justify-start h-auto py-1 px-2 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                                onClick={() => {
                                    setTextSize(preset.fontSize)
                                    setPenColor(preset.color)
                                    handleTextStyleChange({ fontSize: preset.fontSize, fill: preset.color })
                                }}
                            >
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="text-xs font-medium">{preset.name}</span>
                                    <div className="flex items-center gap-1.5 opacity-70">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: preset.color }}
                                        />
                                        <span className="text-[10px]">{preset.fontSize}px</span>
                                    </div>
                                </div>
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700 hover:border-zinc-500"
                        >
                            <Plus className="w-3 h-3 mr-1" /> Save Current Style
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>

        <Button
            variant={activeTool === "eraser" ? "default" : "ghost"}
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => setActiveTool(activeTool === "eraser" ? null : "eraser")}
            title="Eraser"
        >
            <Eraser className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Color picker */}
        <div className="flex items-center gap-1">
            {colors.map((c) => (
                <button
                    key={c}
                    className={`w-5 h-5 rounded-full border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-transform hover:scale-110 ${penColor === c ? "ring-2 ring-ring scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                        setPenColor(c)
                        handleTextStyleChange({ fill: c })
                    }}
                    title={c}
                />
            ))}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={undo}
                disabled={!canUndo}
                title="Undo"
            >
                <Undo2 className="w-4 h-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={redo}
                disabled={!canRedo}
                title="Redo"
            >
                <Redo2 className="w-4 h-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-destructive hover:bg-destructive/10"
                onClick={clearAnnotations}
                title="Clear All"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className={`w-8 h-8 p-0 ${isSaved ? "text-green-500" : ""}`}
                onClick={saveAnnotations}
                title={isSaved ? "Annotations saved" : "Save annotations"}
            >
                <Save className="w-4 h-4" />
            </Button>
        </div>
    </div>
)
