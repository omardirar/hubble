import { cn } from "@hubble/utils"

interface ConnectContainerProps {
  children: React.ReactNode
  className?: string
}

export function ConnectContainer({ children, className }: ConnectContainerProps) {
  return (
    <div className={cn("container mx-auto py-3", className)}>
      <div className="max-w-4xl">{children}</div>
    </div>
  )
}
