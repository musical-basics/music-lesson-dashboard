"use client"

import { useState, useRef } from "react"
import { X, Upload, Music, FileMusic, Youtube, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Piece } from "@/types/piece"

interface PieceEditorModalProps {
    piece?: Piece | null
    userId: string
    onClose: () => void
    onSave: (piece: Piece) => void
}

const DIFFICULTY_LEVELS = [
    "Beginner",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Diploma",
    "Advanced",
]

export function PieceEditorModal({ piece, userId, onClose, onSave }: PieceEditorModalProps) {
    const [title, setTitle] = useState(piece?.title || "")
    const [composer, setComposer] = useState(piece?.composer || "")
    const [difficulty, setDifficulty] = useState(piece?.difficulty || "")
    const [youtubeUrl, setYoutubeUrl] = useState(piece?.youtube_url || "")
    const [xmlFile, setXmlFile] = useState<File | null>(null)
    const [mp3File, setMp3File] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const xmlInputRef = useRef<HTMLInputElement>(null)
    const mp3InputRef = useRef<HTMLInputElement>(null)

    const isEditing = !!piece

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!title.trim()) {
            setError("Title is required")
            return
        }

        if (!isEditing && !xmlFile) {
            setError("XML file is required for new pieces")
            return
        }

        setIsLoading(true)

        try {
            const formData = new FormData()
            formData.append("title", title.trim())
            formData.append("composer", composer.trim())
            formData.append("difficulty", difficulty)
            formData.append("youtube_url", youtubeUrl.trim())
            formData.append("user_id", userId)

            if (xmlFile) {
                formData.append("xml_file", xmlFile)
            }
            if (mp3File) {
                formData.append("mp3_file", mp3File)
            }

            const url = isEditing ? `/api/pieces/${piece.id}` : "/api/pieces"
            const method = isEditing ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                body: formData,
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to save piece")
            }

            const savedPiece = await response.json()
            onSave(savedPiece)
            onClose()

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-white">
                        {isEditing ? "Edit Piece" : "Add New Piece"}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-white"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-zinc-300">Title *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Für Elise"
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>

                    {/* Composer */}
                    <div className="space-y-2">
                        <Label htmlFor="composer" className="text-zinc-300">Composer</Label>
                        <Input
                            id="composer"
                            value={composer}
                            onChange={(e) => setComposer(e.target.value)}
                            placeholder="e.g. Ludwig van Beethoven"
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>

                    {/* Difficulty */}
                    <div className="space-y-2">
                        <Label className="text-zinc-300">Difficulty Level</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                                {DIFFICULTY_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level} className="text-white hover:bg-zinc-700">
                                        {level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* XML File */}
                    <div className="space-y-2">
                        <Label className="text-zinc-300">
                            Sheet Music (MusicXML) {!isEditing && "*"}
                        </Label>
                        <input
                            ref={xmlInputRef}
                            type="file"
                            accept=".xml,.musicxml,.mxl"
                            onChange={(e) => setXmlFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500"
                            onClick={() => xmlInputRef.current?.click()}
                        >
                            <FileMusic className="w-4 h-4 mr-2" />
                            {xmlFile ? xmlFile.name : (piece?.xml_url ? "Replace XML file" : "Upload XML file")}
                        </Button>
                        {piece?.xml_url && !xmlFile && (
                            <p className="text-xs text-zinc-500">Current file will be kept</p>
                        )}
                    </div>

                    {/* MP3 File */}
                    <div className="space-y-2">
                        <Label className="text-zinc-300">Audio File (MP3)</Label>
                        <input
                            ref={mp3InputRef}
                            type="file"
                            accept=".mp3,audio/mpeg"
                            onChange={(e) => setMp3File(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500"
                            onClick={() => mp3InputRef.current?.click()}
                        >
                            <Music className="w-4 h-4 mr-2" />
                            {mp3File ? mp3File.name : (piece?.mp3_url ? "Replace MP3 file" : "Upload MP3 (optional)")}
                        </Button>
                    </div>

                    {/* YouTube URL */}
                    <div className="space-y-2">
                        <Label htmlFor="youtube" className="text-zinc-300">Example Performance (YouTube)</Label>
                        <div className="relative">
                            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <Input
                                id="youtube"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                className="bg-zinc-800 border-zinc-700 text-white pl-10"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1 text-zinc-400"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                isEditing ? "Save Changes" : "Add Piece"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
