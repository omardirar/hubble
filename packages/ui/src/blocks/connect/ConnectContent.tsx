import { cn } from "@hubble/core"

interface ConnectContentProps {
  children: React.ReactNode
  className?: string
}

export function ConnectContent({ children, className }: ConnectContentProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full min-h-[400px] space-y-6",
        className,
      )}
    >
      {children}
    </div>
  )
}
