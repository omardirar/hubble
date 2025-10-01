import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui"
import { cn } from "../../lib/utils"
import { CopyIcon, TrashIcon, RefreshCwIcon, ThumbsUpIcon, ThumbsDownIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes } from "react"
import { toast } from "sonner"

export type ActionsProps = HTMLAttributes<HTMLDivElement>
const ActionsRoot = ({ className, ...props }: ActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
)

export type ActionButtonProps = ComponentProps<typeof Button>
export const ActionButton = ({ className, children, ...props }: ActionButtonProps) => (
  <Button className={cn("h-7 w-7 rounded-md", className)} size="icon" variant="ghost" {...props}>
    {children}
  </Button>
)

const Retry = ({ onRetry }: { onRetry: () => void }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Retry message" type="button" onClick={onRetry}>
          <RefreshCwIcon className="size-3.5" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">Retry</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const Copy = ({ text }: { text: string }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ActionButton aria-label="Copy message" type="button" onClick={handleCopy}>
            <CopyIcon className="size-3.5" />
          </ActionButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">Copy</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const Like = ({ onLike }: { onLike?: () => void }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Like message" type="button" onClick={onLike}>
          <ThumbsUpIcon className="size-3.5" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">Like</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const Dislike = ({ onDislike }: { onDislike?: () => void }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Dislike message" type="button" onClick={onDislike}>
          <ThumbsDownIcon className="size-3.5" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">Dislike</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const Delete = ({ onDelete }: { onDelete?: () => void }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionButton aria-label="Delete message" type="button" onClick={onDelete}>
          <TrashIcon className="size-3.5" />
        </ActionButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">Delete</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export const Actions = Object.assign(ActionsRoot, {
  Retry,
  Copy,
  Like,
  Dislike,
  Delete,
})

// Legacy exports for backwards compatibility
export const CopyAction = Copy
export const DeleteAction = Delete
