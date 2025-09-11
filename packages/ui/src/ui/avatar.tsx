"use client"

import * as React from "react"
import * as RadixAvatar from "@radix-ui/react-avatar"
import { cn } from "@hubble/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof RadixAvatar.Root>) {
  return (
    <RadixAvatar.Root
      data-slot="avatar"
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof RadixAvatar.Image>) {
  return (
    <RadixAvatar.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof RadixAvatar.Fallback>) {
  return (
    <RadixAvatar.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
