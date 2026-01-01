"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { createClient } from "@supabase/supabase-js"
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
import { Loader2, Upload, Music, FileMusic } from "lucide-react"

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AddPieceModalProps {
    userId: string
    onPieceAdded?: () => void
}

export function AddPieceModal({ userId, onPieceAdded }: AddPieceModalProps) {
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const { register, handleSubmit, reset, formState: { errors } } = useForm()

    const onSubmit = async (data: any) => {
        setUploading(true)
        setError("")
        setSuccess(false)

        try {
            const xmlFile = data.xml_file[0]
            const mp3File = data.mp3_file?.[0]

            if (!xmlFile) throw new Error("Sheet Music (XML) is required")

            // 1. Upload XML
            const xmlPath = `${userId}/${Date.now()}_${xmlFile.name}`
            const { error: xmlError } = await supabase.storage
                .from('sheet_music')
                .upload(xmlPath, xmlFile)
            if (xmlError) throw xmlError

            // 2. Upload MP3 (Optional)
            let mp3Path = null
            if (mp3File) {
                mp3Path = `${userId}/${Date.now()}_${mp3File.name}`
                const { error: mp3Error } = await supabase.storage
                    .from('audio_files')
                    .upload(mp3Path, mp3File)
                if (mp3Error) throw mp3Error
            }

            // 3. Get Public URLs
            const { data: { publicUrl: xmlUrl } } = supabase.storage.from('sheet_music').getPublicUrl(xmlPath)
            const mp3Url = mp3Path
                ? supabase.storage.from('audio_files').getPublicUrl(mp3Path).data.publicUrl
                : null

            // 4. Insert into Database
            const { error: dbError } = await supabase
                .from('pieces')
                .insert({
                    user_id: userId,
                    title: data.title,
                    composer: data.composer || null,
                    difficulty: data.difficulty || null,
                    youtube_url: data.youtube_url || null,
                    xml_url: xmlUrl,
                    mp3_url: mp3Url
                })

            if (dbError) throw dbError

            console.log("✅ Piece added successfully!")
            setSuccess(true)
            reset()

            setTimeout(() => {
                setOpen(false)
                setSuccess(false)
                if (onPieceAdded) onPieceAdded()
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
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Upload className="w-4 h-4 mr-2" /> Add New Piece
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-white">Add Repertoire</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Upload a MusicXML file to use in the classroom.
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
                        <Label className="text-zinc-300">Sheet Music (.musicxml or .xml) *</Label>
                        <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-zinc-800/50 transition cursor-pointer relative">
                            <Input
                                type="file"
                                accept=".xml,.musicxml"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                {...register("xml_file", { required: true })}
                            />
                            <FileMusic className="w-8 h-8 text-indigo-400 mb-2" />
                            <span className="text-sm text-zinc-400">Click to upload XML</span>
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
                            {uploading ? "Uploading..." : "Save to Library"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
