"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw, X, Code } from "lucide-react"
import { SheetMusicPanel } from "@/components/sheet-music-panel"
import { useToast } from "@/hooks/use-toast"

interface PieceXmlEditorProps {
    initialXmlUrl: string
    onClose: () => void
    onSave: (newXmlContent: string) => Promise<void>
}

export function PieceXmlEditor({ initialXmlUrl, onClose, onSave }: PieceXmlEditorProps) {
    const [xmlContent, setXmlContent] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string>("")
    const { toast } = useToast()

    // 1. Fetch the raw XML content on mount
    useEffect(() => {
        async function fetchXml() {
            try {
                const res = await fetch(initialXmlUrl)
                const text = await res.text()
                setXmlContent(text)
                setIsLoading(false)
            } catch (e) {
                console.error("Failed to load XML", e)
                toast({ title: "Error loading XML", variant: "destructive" })
                setIsLoading(false)
            }
        }
        fetchXml()
    }, [initialXmlUrl, toast])

    // 2. Generate a Blob URL whenever xmlContent changes (Debounced)
    useEffect(() => {
        if (!xmlContent) return

        // Create a timer to debounce (wait 800ms after typing stops)
        const timer = setTimeout(() => {
            const blob = new Blob([xmlContent], { type: 'application/xml' })
            const url = URL.createObjectURL(blob)
            setPreviewUrl(url)
        }, 800)

        return () => clearTimeout(timer)
    }, [xmlContent])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave(xmlContent)
            toast({ title: "XML Saved!", className: "bg-green-600 text-white" })
            onClose()
        } catch (e) {
            console.error(e)
            toast({ title: "Save failed", variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900">
                <h2 className="font-semibold text-white flex items-center gap-2">
                    <Code className="w-5 h-5 text-indigo-400" />
                    Live XML Editor <span className="text-zinc-500 text-sm font-normal">(Developer Mode)</span>
                </h2>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Split Pane */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Raw Code Editor */}
                <div className="w-1/2 flex flex-col border-r border-zinc-800">
                    <div className="bg-zinc-900 text-zinc-400 text-xs px-4 py-1.5 border-b border-zinc-800 font-medium">
                        Raw MusicXML
                    </div>
                    <textarea
                        className="flex-1 w-full bg-zinc-950 text-zinc-300 font-mono text-xs sm:text-sm p-4 resize-none focus:outline-none custom-scrollbar leading-relaxed"
                        value={xmlContent}
                        onChange={(e) => setXmlContent(e.target.value)}
                        spellCheck={false}
                    />
                </div>

                {/* RIGHT: Live Preview */}
                <div className="w-1/2 flex flex-col bg-zinc-900">
                    <div className="bg-zinc-900 text-zinc-400 text-xs px-4 py-1.5 border-b border-zinc-800 flex justify-between items-center font-medium">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="w-3 h-3" />
                            Live Preview
                        </div>
                        <span className="text-zinc-600">Updates automatically after typing stops</span>
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-white">
                        {previewUrl && (
                            <SheetMusicPanel
                                key={previewUrl} // FORCE re-mount to clear OSMD artifacts
                                xmlUrl={previewUrl}
                                songId="preview"
                                studentId="preview"
                                isStudent={false}
                                readOnly={true} // Preview mode should be read-only to avoid interaction confusion
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
