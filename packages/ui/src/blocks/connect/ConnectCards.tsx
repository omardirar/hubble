import { cn } from "@hubble/utils"
import { Button } from "@hubble/ui"
import { connectCardIcons } from "@hubble/ui"

interface ConnectCardItemProps {
  icon: keyof typeof connectCardIcons
  name: string
  description?: string
  onConnect?: () => void
  isConnected?: boolean
  className?: string
}

export function ConnectCardItem({
  icon,
  name,
  onConnect,
  isConnected = false,
  className,
}: ConnectCardItemProps) {
  const iconData = connectCardIcons[icon]

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg">
          <img src={iconData.icon} alt={iconData.alt} className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">{name}</h3>
        </div>
        <Button onClick={onConnect} variant={isConnected ? "secondary" : "default"} size="sm">
          {isConnected ? "Connected" : "Connect"}
        </Button>
      </div>
    </div>
  )
}
