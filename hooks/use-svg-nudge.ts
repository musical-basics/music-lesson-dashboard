import { useState, useCallback, useEffect } from 'react'

export type NudgeOffsets = Record<string, { x: number; y: number }>

export function useSvgNudge(songId: string | null) {
    const [offsets, setOffsets] = useState<NudgeOffsets>({})
    const [isLoading, setIsLoading] = useState(false)

    // Fetch offsets from API on mount / songId change
    useEffect(() => {
        if (!songId) return

        setIsLoading(true)
        fetch(`/api/nudge-offsets?songId=${songId}`)
            .then(res => res.json())
            .then(data => {
                if (data && typeof data === 'object' && !data.error) {
                    setOffsets(data)
                }
            })
            .catch(err => console.error('Failed to fetch nudge offsets:', err))
            .finally(() => setIsLoading(false))
    }, [songId])

    // Apply all offsets to SVG elements in the container
    const applyOffsetsToSvg = useCallback((container: HTMLElement | null) => {
        if (!container) return

        // Find all text elements in the SVG
        const textElements = container.querySelectorAll('text')

        textElements.forEach((el, index) => {
            // Create a unique selector based on content + index
            const content = el.textContent?.trim() || ''
            const selector = `text-${index}-${content.slice(0, 20).replace(/\s+/g, '_')}`

            const offset = offsets[selector]
            if (offset) {
                // Apply CSS transform
                el.style.transform = `translate(${offset.x}px, ${offset.y}px)`
                el.setAttribute('data-nudge-selector', selector)
            } else {
                // Mark element for later nudging
                el.setAttribute('data-nudge-selector', selector)
            }
        })
    }, [offsets])

    // Update a specific offset
    const updateOffset = useCallback((selector: string, axis: 'x' | 'y', delta: number) => {
        setOffsets(prev => {
            const current = prev[selector] || { x: 0, y: 0 }
            const newOffset = {
                ...current,
                [axis]: current[axis] + delta
            }
            return { ...prev, [selector]: newOffset }
        })
    }, [])

    // Save offsets to API
    const saveOffsets = useCallback(async () => {
        if (!songId) return

        try {
            const promises = Object.entries(offsets).map(([selector, offset]) =>
                fetch('/api/nudge-offsets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        songId,
                        selector,
                        offsetX: offset.x,
                        offsetY: offset.y
                    })
                })
            )
            await Promise.all(promises)
            console.log('Nudge offsets saved!')
        } catch (err) {
            console.error('Failed to save nudge offsets:', err)
        }
    }, [songId, offsets])

    // Get elements for a specific measure (by querying the rendered SVG)
    const getElementsInMeasure = useCallback((container: HTMLElement | null, measureNumber: number): { selector: string; text: string }[] => {
        if (!container) return []

        const elements: { selector: string; text: string }[] = []
        const textElements = container.querySelectorAll('text')
        const seenSelectors = new Set<string>()

        textElements.forEach((el) => {
            const selector = el.getAttribute('data-nudge-selector')
            const text = el.textContent?.trim() || ''

            // Deduplicate: only add if we haven't seen this selector before
            if (selector && text && !seenSelectors.has(selector)) {
                seenSelectors.add(selector)
                elements.push({ selector, text })
            }
        })

        return elements
    }, [])

    return {
        offsets,
        isLoading,
        applyOffsetsToSvg,
        updateOffset,
        saveOffsets,
        getElementsInMeasure
    }
}
