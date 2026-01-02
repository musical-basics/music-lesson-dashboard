"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Music, Video, FileMusic, Trash2, Users, Library, ExternalLink, Pencil } from "lucide-react"
import { PieceModal } from "@/components/studio/piece-modal"
import { Piece } from "@/types/piece"
import { DashboardSidebar } from "@/components/dashboard-sidebar"

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StudioPage() {
    const [pieces, setPieces] = useState<Piece[]>([])
    const [userId, setUserId] = useState<string>("teacher-1") // Default for now
    const [loading, setLoading] = useState(true)

    const fetchPieces = async () => {
        try {
            const { data, error } = await supabase
                .from('pieces')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setPieces(data || [])
        } catch (error) {
            console.error("Error fetching pieces:", error)
        } finally {
            setLoading(false)
        }
    }

    // Delete Piece Logic
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this piece?")) return

        const { error } = await supabase.from('pieces').delete().eq('id', id)
        if (!error) {
            setPieces(pieces.filter(p => p.id !== id))
        }
    }

    useEffect(() => {
        fetchPieces()
    }, [])

    return (
        <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
            <DashboardSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-zinc-800 flex items-center px-6 bg-zinc-900/50 shrink-0">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Teacher Studio
                    </h1>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    <div className="max-w-6xl mx-auto">

                        <Tabs defaultValue="library" className="space-y-6">
                            <div className="flex items-center justify-between">
                                <TabsList className="bg-zinc-800 border-zinc-700">
                                    <TabsTrigger value="students" className="data-[state=active]:bg-zinc-700">
                                        <Users className="w-4 h-4 mr-2" /> Students
                                    </TabsTrigger>
                                    <TabsTrigger value="library" className="data-[state=active]:bg-zinc-700">
                                        <Library className="w-4 h-4 mr-2" /> Library
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* --- LIBRARY TAB --- */}
                            <TabsContent value="library" className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold">Repertoire Library</h2>
                                        <p className="text-zinc-400">Manage sheet music and resources for your students.</p>
                                    </div>
                                    {/* The Add Button */}
                                    <PieceModal
                                        userId={userId}
                                        onPieceSaved={fetchPieces}
                                    />
                                </div>

                                {loading ? (
                                    <div className="text-zinc-500">Loading library...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {pieces.map((piece) => (
                                            <Card key={piece.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                                                <CardHeader className="pb-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg text-white">{piece.title}</CardTitle>
                                                            <CardDescription className="text-zinc-400">{piece.composer || "Unknown Composer"}</CardDescription>
                                                        </div>
                                                        {piece.difficulty && (
                                                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
                                                                {piece.difficulty}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-2 pb-3">
                                                    <div className="flex gap-2 flex-wrap">
                                                        <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                                                            <FileMusic className="w-3 h-3 mr-1" /> XML
                                                        </Badge>
                                                        {piece.mp3_url && (
                                                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                                                                <Music className="w-3 h-3 mr-1" /> MP3
                                                            </Badge>
                                                        )}
                                                        {piece.youtube_url && (
                                                            <a
                                                                href={piece.youtube_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex"
                                                            >
                                                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                                                                    <Video className="w-3 h-3 mr-1" /> Video
                                                                    <ExternalLink className="w-2.5 h-2.5 ml-1" />
                                                                </Badge>
                                                            </a>
                                                        )}
                                                    </div>
                                                </CardContent>
                                                <CardFooter className="pt-0 flex justify-end gap-2">
                                                    <PieceModal
                                                        userId={userId}
                                                        piece={piece}
                                                        onPieceSaved={fetchPieces}
                                                        trigger={
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-zinc-500 hover:text-white hover:bg-zinc-800"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                        }
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-zinc-500 hover:text-red-400 hover:bg-red-900/10"
                                                        onClick={() => handleDelete(piece.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))}

                                        {pieces.length === 0 && (
                                            <div className="col-span-full text-center py-12 border-2 border-dashed border-zinc-800 rounded-lg">
                                                <FileMusic className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                                                <p className="text-zinc-500 mb-4">No pieces found. Upload your first one!</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>

                            {/* --- STUDENTS TAB (Placeholder) --- */}
                            <TabsContent value="students">
                                <div className="p-8 border border-zinc-800 rounded-lg bg-zinc-900/30 text-center text-zinc-500">
                                    <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                                    <p>Your student roster will go here.</p>
                                    <p className="text-sm mt-2">Manage students and schedule lessons.</p>
                                </div>
                            </TabsContent>

                        </Tabs>
                    </div>
                </main>
            </div>
        </div>
    )
}
