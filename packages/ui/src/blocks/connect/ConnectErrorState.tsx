import { Button } from "@hubble/ui"

interface ConnectErrorStateProps {
  title?: string
  error: string
  onRetry: () => void
  retryText?: string
}

export function ConnectErrorState({
  title = "Setup Failed",
  error,
  onRetry,
  retryText = "Try Again",
}: ConnectErrorStateProps) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{error}</p>
      <Button onClick={onRetry} variant="outline">
        {retryText}
      </Button>
    </div>
  )
}
