import { useState, useCallback, useEffect } from 'react'

export function useXmlNudge(initialXml: string) {
    const [xmlString, setXmlString] = useState(initialXml)

    // Update xmlString when initialXml changes (if fetched asynchronously)
    useEffect(() => {
        if (initialXml) setXmlString(initialXml)
    }, [initialXml])

    const updateElementPosition = useCallback((measureNumber: number, elementIndex: number, axis: 'x' | 'y', delta: number) => {
        if (!xmlString) return

        const parser = new DOMParser()
        const doc = parser.parseFromString(xmlString, "text/xml")

        // Find the specific measure (Measure numbers are 1-based in UI, but 0-based in array usually)
        // MusicXML <measure> tags are sequential.
        const measures = doc.getElementsByTagName("measure")
        // NOTE: Measure indexing can be tricky. Usually they are sequential in the DOM.
        // If the piece has pick-up measures or multiple movements, simple indexing might be off.
        // But for standard files, index = number - 1 is a good starting point.
        const targetMeasure = measures[measureNumber - 1]

        if (!targetMeasure) {
            console.warn(`Measure ${measureNumber} not found`)
            return
        }

        // Find all "directions" (Text, Dynamics, Wedges) in this measure
        const directions = targetMeasure.getElementsByTagName("direction")
        const targetElement = directions[elementIndex]

        if (targetElement) {
            // We need to apply the offset to the specific child (words, dynamics, etc)
            const positioningNode = targetElement.querySelector('words, dynamics, wedge, rehearsal')

            if (positioningNode) {
                // SWITCH TO RELATIVE POSITIONING
                // 'relative-y' pushes element UP/DOWN from its auto-calculated spot.
                // 'relative-x' pushes element LEFT/RIGHT.
                const attr = axis === 'x' ? 'relative-x' : 'relative-y'

                // Get current value (default to 0 if not set)
                const currentVal = parseFloat(positioningNode.getAttribute(attr) || "0")

                // Apply delta
                const newVal = currentVal + delta

                // Update XML
                positioningNode.setAttribute(attr, newVal.toString())

                // [Optional] Clean up absolute positioning to stop it from confusing OSMD?
                // Sometimes removing default-y helps, but usually relative-y overrides it effectively.
                // positioningNode.removeAttribute('default-y') 
                // positioningNode.removeAttribute('default-x')
                console.log(`Nudged Measure ${measureNumber} Element ${elementIndex} ${axis} to ${newVal}`)

                const serializer = new XMLSerializer()
                setXmlString(serializer.serializeToString(doc))
            } else {
                console.warn("No positioning node found in direction")
            }
        } else {
            console.warn(`Element ${elementIndex} not found in measure ${measureNumber}`)
        }
    }, [xmlString])

    return { xmlString, setXmlString, updateElementPosition }
}
