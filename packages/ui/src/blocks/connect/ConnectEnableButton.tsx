import { Button } from "@hubble/ui"

interface ConnectEnableButtonProps {
  onEnable: () => void
  disabled?: boolean
  children?: React.ReactNode
}

export function ConnectEnableButton({
  onEnable,
  disabled = false,
  children = "Enable Connect",
}: ConnectEnableButtonProps) {
  return (
    <Button onClick={onEnable} size="lg" className="px-8 py-3" disabled={disabled}>
      {children}
    </Button>
  )
}
