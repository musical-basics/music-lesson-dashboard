import * as React from 'react'

const MOBILE_BREAKPOINT = 768

// A phone rotated to landscape is ~930px wide, so a width check alone
// serves it the desktop layout. Short touchscreens are still phones.
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px), (max-height: 500px) and (pointer: coarse)`

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => {
      setMatches(mql.matches)
    }
    mql.addEventListener('change', onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return !!matches
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}

// A phone held sideways: touch device with very little vertical room. Lesson
// controls move to a side rail so they don't eat the video's height.
export function useIsShortLandscape() {
  return useMediaQuery('(max-height: 500px) and (pointer: coarse) and (orientation: landscape)')
}
