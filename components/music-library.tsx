"use client"
import { useState, useEffect } from 'react'
import { Upload, Music, FileMusic, Trash2 } from 'lucide-react'

export type Song = {
    id: string
    title: string
    url: string
    xmlContent?: string // We store the raw text here for persistence
    isCustom?: boolean  // To know which ones can be deleted
}

interface MusicLibraryProps {
    currentSongId: string
    onSelectSong: (song: Song) => void
}

export function MusicLibrary({ currentSongId, onSelectSong }: MusicLibraryProps) {
    // 1. Define Defaults
    const defaultSongs: Song[] = [
        {
            id: 'la-campanella',
            title: 'La Campanella Remix',
            url: '/xmls/La Campanella Remix v8.musicxml'
        },
        {
            id: 'c-major',
            title: 'C Major Exercise',
            url: '/xmls/c-major-exercise.musicxml'
        }
    ]

    const [songs, setSongs] = useState<Song[]>(defaultSongs)

    // 2. Load Saved Songs on Mount
    useEffect(() => {
        const saved = localStorage.getItem('my-music-library')
        if (saved) {
            try {
                const parsed: Song[] = JSON.parse(saved)

                // Critical Step: Re-create Blob URLs from the saved text
                const rehydratedSongs = parsed.map(s => {
                    if (s.xmlContent) {
                        const blob = new Blob([s.xmlContent], { type: 'application/xml' })
                        return { ...s, url: URL.createObjectURL(blob) }
                    }
                    return s
                })

                // Merge defaults with saved custom songs
                // (We filter out defaults from saved to avoid duplicates if ID logic changes)
                setSongs([...defaultSongs, ...rehydratedSongs])
            } catch (e) {
                console.error("Failed to load library", e)
            }
        }
    }, [])

    // 3. Handle File Upload (Read as Text -> Save -> Create URL)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            if (!text) return

            const objectUrl = URL.createObjectURL(new Blob([text]))

            const newSong: Song = {
                id: `custom-${Date.now()}`,
                title: file.name.replace('.xml', '').replace('.musicxml', ''),
                url: objectUrl,
                xmlContent: text, // Save the raw data
                isCustom: true
            }

            // Update State
            const updatedLibrary = [...songs, newSong]
            setSongs(updatedLibrary)
            onSelectSong(newSong)

            // Save Custom Songs to Storage
            // We only save the 'isCustom' ones to avoid duplicating defaults
            const customSongs = updatedLibrary.filter(s => s.isCustom)
            localStorage.setItem('my-music-library', JSON.stringify(customSongs))
        }
        reader.readAsText(file) // Start reading
    }

    // Optional: Delete Function
    const deleteSong = (e: React.MouseEvent, songId: string) => {
        e.stopPropagation()
        if (!confirm("Remove this song from library?")) return

        const updated = songs.filter(s => s.id !== songId)
        setSongs(updated)

        // Update Storage
        const customSongs = updated.filter(s => s.isCustom)
        localStorage.setItem('my-music-library', JSON.stringify(customSongs))

        // If we deleted the active song, switch to default
        if (currentSongId === songId) {
            onSelectSong(defaultSongs[0])
        }
    }

    return (
        <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
                <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Music className="w-4 h-4 text-indigo-500" /> Library
                </h2>
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

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {songs.map(song => (
                    <div
                        key={song.id}
                        onClick={() => onSelectSong(song)}
                        className={`group w-full flex items-center justify-between p-3 rounded-md text-left text-sm transition-all cursor-pointer ${currentSongId === song.id
                                ? 'bg-zinc-800 text-white border-l-2 border-indigo-500'
                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                            }`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileMusic className="w-4 h-4 opacity-70 flex-shrink-0" />
                            <span className="truncate">{song.title}</span>
                        </div>

                        {/* Delete Button (Only for custom uploads) */}
                        {song.isCustom && (
                            <button
                                onClick={(e) => deleteSong(e, song.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                title="Remove song"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
