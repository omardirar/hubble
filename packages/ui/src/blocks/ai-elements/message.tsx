import { Avatar, AvatarFallback, AvatarImage } from "../../ui"
import { cn } from "@hubble/utils"
import type { ComponentProps, HTMLAttributes } from "react"

type Role = "user" | "assistant"

export type MessageProps = HTMLAttributes<HTMLDivElement> & { from: Role }
export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end gap-2 py-4",
      from === "user" ? "is-user justify-end" : "is-assistant justify-start",
      "[&>div]:max-w-[80%]",
      className,
    )}
    {...props}
  />
)

export type MessageContentProps = HTMLAttributes<HTMLDivElement>
export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "text-foreground flex flex-col gap-2 overflow-hidden rounded-lg p-2 text-sm",
      "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
      "group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground",
      "is-user:dark",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export type MessageAvatarProps = ComponentProps<typeof Avatar> & { src: string; name?: string }
export const MessageAvatar = ({ src, name, className, ...props }: MessageAvatarProps) => (
  <Avatar className={cn("ring-border size-8 ring-1", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
)
