import { Spinner } from "@hubble/ui"

interface ConnectStatusCheckerProps {
  message?: string
}

export function ConnectStatusChecker({
  message = "Checking provisioning status...",
}: ConnectStatusCheckerProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <Spinner size={32} className="text-primary" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
