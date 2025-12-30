"use client"

interface HorizontalAnnotationProps {
    totalWidth: number
    height: number
    chunkId?: string
}

export function HorizontalAnnotation({ totalWidth, height, chunkId }: HorizontalAnnotationProps) {
    return (
        <div
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: totalWidth, height }}
        >
            {/* 
        This is where the transparent canvas for drawing will go later.
        For now, we just pass through events so the music is visible. 
        Using pointer-events-none allows clicks to pass through to the music if needed,
        but for annotation we'll likely toggle this.
      */}
            <div className="absolute bottom-2 right-2 opacity-50">
                {/* Debug marker */}
                <span className="text-[10px] text-red-500 bg-white/80 px-1 border border-red-200">
                    Annotation Layer
                </span>
            </div>
        </div>
    )
}
