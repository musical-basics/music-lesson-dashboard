"use client"

import { useState, useEffect } from "react"
import { Plus, Music, ChevronDown, Edit2, Trash2, Youtube, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Piece } from "@/types/piece"
import { PieceEditorModal } from "./piece-editor-modal"

interface PieceSelectorProps {
    userId: string
    selectedPiece: Piece | null
    onSelectPiece: (piece: Piece | null) => void
    disabled?: boolean
}

export function PieceSelector({ userId, selectedPiece, onSelectPiece, disabled }: PieceSelectorProps) {
    const [pieces, setPieces] = useState<Piece[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showEditor, setShowEditor] = useState(false)
    const [editingPiece, setEditingPiece] = useState<Piece | null>(null)

    // Fetch pieces on mount
    useEffect(() => {
        async function fetchPieces() {
            try {
                const res = await fetch(`/api/pieces?userId=${userId}`)
                if (res.ok) {
                    const data = await res.json()
                    setPieces(data)
                    // Auto-select first piece if none selected
                    if (data.length > 0 && !selectedPiece) {
                        onSelectPiece(data[0])
                    }
                }
            } catch (e) {
                console.error("Failed to fetch pieces:", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchPieces()
    }, [userId])

    const handleAddNew = () => {
        setEditingPiece(null)
        setShowEditor(true)
    }

    const handleEdit = (piece: Piece, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingPiece(piece)
        setShowEditor(true)
    }

    const handleDelete = async (piece: Piece, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(`Delete "${piece.title}"? This cannot be undone.`)) return

        try {
            const res = await fetch(`/api/pieces/${piece.id}`, { method: "DELETE" })
            if (res.ok) {
                setPieces(pieces.filter(p => p.id !== piece.id))
                if (selectedPiece?.id === piece.id) {
                    onSelectPiece(pieces.length > 1 ? pieces.find(p => p.id !== piece.id) || null : null)
                }
            }
        } catch (e) {
            console.error("Failed to delete piece:", e)
        }
    }

    const handleSave = (savedPiece: Piece) => {
        if (editingPiece) {
            // Update existing
            setPieces(pieces.map(p => p.id === savedPiece.id ? savedPiece : p))
            if (selectedPiece?.id === savedPiece.id) {
                onSelectPiece(savedPiece)
            }
        } else {
            // Add new
            setPieces([savedPiece, ...pieces])
            onSelectPiece(savedPiece)
        }
    }

    if (isLoading) {
        return (
            <Button variant="outline" disabled className="min-w-[200px] justify-between">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="ml-2">Loading pieces...</span>
            </Button>
        )
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className="min-w-[200px] justify-between bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Music className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="truncate">
                                {selectedPiece ? selectedPiece.title : "Select a piece..."}
                            </span>
                        </div>
                        <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    className="w-[300px] bg-zinc-900 border-zinc-800"
                >
                    {pieces.length === 0 ? (
                        <div className="p-4 text-center text-zinc-500 text-sm">
                            No pieces yet. Add your first one!
                        </div>
                    ) : (
                        pieces.map((piece) => (
                            <DropdownMenuItem
                                key={piece.id}
                                onClick={() => onSelectPiece(piece)}
                                className="flex items-center justify-between px-3 py-2 cursor-pointer text-white hover:bg-zinc-800 focus:bg-zinc-800"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{piece.title}</div>
                                    <div className="text-xs text-zinc-500 truncate">
                                        {[piece.composer, piece.difficulty].filter(Boolean).join(" • ")}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {piece.youtube_url && (
                                        <a
                                            href={piece.youtube_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1 hover:bg-zinc-700 rounded"
                                        >
                                            <Youtube className="w-3 h-3 text-red-500" />
                                        </a>
                                    )}
                                    <button
                                        onClick={(e) => handleEdit(piece, e)}
                                        className="p-1 hover:bg-zinc-700 rounded"
                                    >
                                        <Edit2 className="w-3 h-3 text-zinc-400" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(piece, e)}
                                        className="p-1 hover:bg-zinc-700 rounded"
                                    >
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                    </button>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}

                    <DropdownMenuSeparator className="bg-zinc-800" />

                    <DropdownMenuItem
                        onClick={handleAddNew}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-indigo-400 hover:bg-zinc-800 focus:bg-zinc-800"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Piece
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {showEditor && (
                <PieceEditorModal
                    piece={editingPiece}
                    userId={userId}
                    onClose={() => setShowEditor(false)}
                    onSave={handleSave}
                />
            )}
        </>
    )
}
