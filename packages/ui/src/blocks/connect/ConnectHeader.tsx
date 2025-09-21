interface ConnectHeaderProps {
  title?: string
  description?: string
}

export function ConnectHeader({
  title = "Connect",
  description = "Set up your data pipeline with MotherDuck and Fivetran integration.",
}: ConnectHeaderProps) {
  return (
    <>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </>
  )
}
