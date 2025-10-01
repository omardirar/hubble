import { cn } from "@hubble/core"
import { YourConnectionsSection } from "./YourConnectionsSection"
import { AvailableConnectionsSection } from "./AvailableConnectionsSection"

interface ConnectSectionsProps {
  className?: string
}

export function ConnectSections({ className }: ConnectSectionsProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <YourConnectionsSection />
      <AvailableConnectionsSection />
    </div>
  )
}
