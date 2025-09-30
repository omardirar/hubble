import * as React from "react"

const MOBILE_BREAKPOINT = 768

// TODO: Add support for custom breakpoints
//   Context: Allow consumers to specify different breakpoints for mobile detection.
//   labels: area/ui, feature/responsive, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
