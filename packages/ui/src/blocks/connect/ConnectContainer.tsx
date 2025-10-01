import { cn } from "@hubble/core"

interface ConnectContainerProps {
  children: React.ReactNode
  className?: string
}

export function ConnectContainer({ children, className }: ConnectContainerProps) {
  return (
    <div className={cn("container mx-auto py-3 h-full", className)}>
      <div className="max-auto h-full">{children}</div>
    </div>
  )
}
