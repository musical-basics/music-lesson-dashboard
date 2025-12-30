"use client"
import { useState } from 'react'
import { Upload, Music, FileMusic } from 'lucide-react'

export type Song = {
    id: string
    title: string
    url: string // Can be a remote URL or a blob: URL
}

interface MusicLibraryProps {
    currentSongId: string
    onSelectSong: (song: Song) => void
}

export function MusicLibrary({ currentSongId, onSelectSong }: MusicLibraryProps) {
    // Default Library
    const [songs, setSongs] = useState<Song[]>([
        {
            id: 'la-campanella',
            title: 'La Campanella Remix',
            url: '/xmls/La Campanella Remix v8.musicxml' // Ensure this path is correct
        },
        {
            id: 'demo-bach',
            title: 'Bach - Minuet in G',
            url: 'https://opensheetmusicdisplay.github.io/demo/sheets/JohannSebastianBach_Air.xml'
        }
    ])

    // Handle File Upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Create a temporary Blob URL for the file
        const objectUrl = URL.createObjectURL(file)

        const newSong: Song = {
            id: `local-${Date.now()}`, // Unique ID for namespace
            title: file.name.replace('.xml', '').replace('.musicxml', ''),
            url: objectUrl
        }

        setSongs([...songs, newSong])
        onSelectSong(newSong) // Auto-select the uploaded file
    }

    return (
        <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
                <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Music className="w-4 h-4 text-indigo-500" /> Library
                </h2>

                {/* Upload Button */}
                <label className="flex items-center justify-center gap-2 w-full p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer text-sm font-medium transition-colors">
                    <Upload className="w-4 h-4" /> Import XML
                    <input
                        type="file"
                        accept=".xml,.musicxml"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                </label>
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {songs.map(song => (
                    <button
                        key={song.id}
                        onClick={() => onSelectSong(song)}
                        className={`w-full flex items-center gap-3 p-3 rounded-md text-left text-sm transition-all ${currentSongId === song.id
                                ? 'bg-zinc-800 text-white border-l-2 border-indigo-500'
                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                            }`}
                    >
                        <FileMusic className="w-4 h-4 opacity-70" />
                        <span className="truncate">{song.title}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
