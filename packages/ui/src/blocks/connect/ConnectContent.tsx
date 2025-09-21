import { cn } from "@hubble/utils"

interface ConnectContentProps {
  children: React.ReactNode
  className?: string
}

export function ConnectContent({ children, className }: ConnectContentProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center min-h-[400px] space-y-6", className)}
    >
      {children}
    </div>
  )
}
