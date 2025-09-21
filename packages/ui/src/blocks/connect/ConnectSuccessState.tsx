interface ConnectSuccessStateProps {
  title?: string
  description?: string
  cardsTitle?: string
  cardsDescription?: string
}

export function ConnectSuccessState({
  title = "Connect Setup Complete!",
  description = "Your data pipeline is ready to use.",
  cardsTitle = "Connect Cards (WIP)",
  cardsDescription = "This section will contain your data source connections and pipeline status.",
}: ConnectSuccessStateProps) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg
          className="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h3 className="text-lg font-medium mb-2">{cardsTitle}</h3>
        <p className="text-sm text-muted-foreground">{cardsDescription}</p>
      </div>
    </div>
  )
}
