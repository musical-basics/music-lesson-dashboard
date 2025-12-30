"use client"

interface AnnotationRailProps {
    totalWidth: number
    height: number
}

export function AnnotationRail({ totalWidth, height }: AnnotationRailProps) {
    return (
        <div
            className="absolute top-0 left-0"
            style={{ width: totalWidth, height }}
        >
            {/* 
        This is a placeholder for the future drawing canvas chunks.
        It sits on top of the music. 
      */}
            <div className="absolute top-2 right-2 bg-yellow-100/80 px-2 py-1 border border-yellow-300 rounded text-xs text-yellow-800">
                Annotation Rail Active ({Math.round(totalWidth)}px width)
            </div>
        </div>
    )
}
