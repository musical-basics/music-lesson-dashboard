"use client"

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Music, FileMusic, Pencil } from "lucide-react"
import { Piece } from "@/types/piece"

interface PieceModalProps {
    userId: string
    piece?: Piece
    trigger?: React.ReactNode
    onPieceSaved?: () => void
}

export function PieceModal({ userId, piece, trigger, onPieceSaved }: PieceModalProps) {
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [xmlFileName, setXmlFileName] = useState<string | null>(null)

    const xmlInputRef = useRef<HTMLInputElement>(null)

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: {
            title: piece?.title || "",
            composer: piece?.composer || "",
            difficulty: piece?.difficulty || "",
            youtube_url: piece?.youtube_url || "",
            xml_file: null,
            mp3_file: null,
        }
    })

    const onSubmit = async (data: any) => {
        setUploading(true)
        setError("")
        setSuccess(false)

        try {
            const xmlFile = data.xml_file?.[0]
            const mp3File = data.mp3_file?.[0]

            if (!piece && !xmlFile) throw new Error("Sheet Music (XML) is required")

            // Build FormData for the API route
            const formData = new FormData()
            formData.append("title", data.title)
            formData.append("user_id", userId)

            if (xmlFile) formData.append("xml_file", xmlFile)

            if (data.composer) formData.append("composer", data.composer)
            if (data.difficulty) formData.append("difficulty", data.difficulty)
            if (data.youtube_url) formData.append("youtube_url", data.youtube_url)
            if (mp3File) formData.append("mp3_file", mp3File)

            // Determine URL and Method
            const url = piece ? `/api/pieces/${piece.id}` : "/api/pieces"
            const method = piece ? "PUT" : "POST"

            // Call the API route (uses service role key, bypasses RLS)
            const response = await fetch(url, {
                method,
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Failed to add piece")
            }

            console.log(`✅ Piece ${piece ? "updated" : "added"} successfully!`)
            setSuccess(true)
            if (!piece) {
                reset()
                setXmlFileName(null)
            }

            setTimeout(() => {
                setOpen(false)
                setSuccess(false)
                if (onPieceSaved) onPieceSaved()
            }, 1000)

        } catch (err: any) {
            console.error("Error adding piece:", err)
            setError(err.message || "Failed to add piece")
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Upload className="w-4 h-4 mr-2" /> Add New Piece
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-white">{piece ? "Edit Repertoire" : "Add Repertoire"}</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {piece ? "Update details or replace files." : "Upload a MusicXML file to use in the classroom."}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                        Piece added successfully!
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-zinc-300">Title *</Label>
                            <Input
                                id="title"
                                {...register("title", { required: true })}
                                placeholder="e.g. La Campanella"
                                className="bg-zinc-800 border-zinc-700 text-white"
                            />
                            {errors.title && <span className="text-xs text-red-500">Required</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="composer" className="text-zinc-300">Composer</Label>
                            <Input
                                id="composer"
                                {...register("composer")}
                                placeholder="e.g. Liszt"
                                className="bg-zinc-800 border-zinc-700 text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="difficulty" className="text-zinc-300">Difficulty</Label>
                            <select
                                {...register("difficulty")}
                                className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                            >
                                <option value="">Select...</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="youtube" className="text-zinc-300">YouTube URL</Label>
                            <Input
                                id="youtube"
                                {...register("youtube_url")}
                                placeholder="https://..."
                                className="bg-zinc-800 border-zinc-700 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-zinc-300">Sheet Music (.musicxml or .xml) {piece ? "(Optional)" : "*"}</Label>
                        <input
                            type="file"
                            accept=".xml,.musicxml"
                            className="hidden"
                            {...register("xml_file", { required: !piece })}
                            ref={(e) => {
                                register("xml_file", { required: !piece }).ref(e)
                                xmlInputRef.current = e
                            }}
                            onChange={(e) => {
                                register("xml_file", { required: true }).onChange(e)
                                const file = e.target.files?.[0]
                                setXmlFileName(file ? file.name : null)
                            }}
                        />
                        <div
                            onClick={() => xmlInputRef.current?.click()}
                            className="border-2 border-dashed border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-zinc-800/50 transition cursor-pointer"
                        >
                            <FileMusic className="w-8 h-8 text-indigo-400 mb-2" />
                            <span className="text-sm text-zinc-400">
                                {xmlFileName ? xmlFileName : (piece?.xml_url ? "Click to replace XML" : "Click to upload XML")}
                            </span>
                        </div>
                        {errors.xml_file && <span className="text-xs text-red-500">File required</span>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-zinc-300">Reference Audio (.mp3) (Optional)</Label>
                        <div className="border border-zinc-700 rounded-md px-3 py-2 flex items-center gap-2 bg-zinc-800">
                            <Music className="w-4 h-4 text-zinc-500" />
                            <input
                                type="file"
                                accept=".mp3,.wav"
                                className="text-sm w-full bg-transparent text-zinc-300 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-zinc-700 file:text-zinc-300"
                                {...register("mp3_file")}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="border-zinc-700 text-zinc-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={uploading}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {uploading ? "Uploading..." : (piece ? "Save Changes" : "Save to Library")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
