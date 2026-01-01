// types/piece.ts
export interface Piece {
    id: string
    user_id: string
    title: string
    composer: string
    difficulty: string
    youtube_url?: string
    xml_url: string
    mp3_url?: string
    created_at: string
}
