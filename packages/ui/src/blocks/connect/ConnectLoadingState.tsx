import { Spinner } from "@hubble/ui"

interface ConnectLoadingStateProps {
  message?: string
}

export function ConnectLoadingState({
  message = "Setting up your data pipeline...",
}: ConnectLoadingStateProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <Spinner size={32} className="text-primary" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
