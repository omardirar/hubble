import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui"
import { cn } from "@hubble/utils"
import { CopyIcon, TrashIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes } from "react"

export type ActionsProps = HTMLAttributes<HTMLDivElement>
export const Actions = ({ className, ...props }: ActionsProps) => (
  <div className={cn("flex items-center gap-1.5", className)} {...props} />
)

export type ActionButtonProps = ComponentProps<typeof Button>
export const ActionButton = ({ className, children, ...props }: ActionButtonProps) => (
  <Button className={cn("rounded-md", className)} size="icon" variant="ghost" {...props}>
    {children}
  </Button>
)

export const CopyAction = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Copy message" type="button">
          <CopyIcon className="size-4" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent>Copy</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export const DeleteAction = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Delete message" type="button">
          <TrashIcon className="size-4" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent>Delete</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
