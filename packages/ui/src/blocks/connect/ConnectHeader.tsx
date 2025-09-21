interface ConnectHeaderProps {
  title?: string
  description?: string
}

export function ConnectHeader({
  title = "Connect",
  description = "Set up your data pipeline with MotherDuck and Fivetran integration.",
}: ConnectHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground mb-6">{description}</p>
    </div>
  )
}
