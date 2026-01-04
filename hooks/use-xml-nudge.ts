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
            // Find or Create <direction-type> -> <words> or <dynamics>
            // We usually want to apply the offset to the <direction> tag itself or its child
            // But MusicXML often puts default-x/y on the <direction-type>'s child (like <words>)

            // Strategy: Look for the <words> or <dynamics> tag inside
            const positioningNode = targetElement.querySelector('words, dynamics, wedge')

            // If the specific node doesn't exist or doesn't have the attr, we might need to look at <direction>
            // For now, let's try updating the child node which OSMD reads.
            if (positioningNode) {
                const attr = axis === 'x' ? 'default-x' : 'default-y'
                const currentVal = parseFloat(positioningNode.getAttribute(attr) || "0")
                const newVal = currentVal + delta
                positioningNode.setAttribute(attr, newVal.toString())
                console.log(`Nudged Measure ${measureNumber} Element ${elementIndex} ${axis} to ${newVal}`)

                // Serialize back to string
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
