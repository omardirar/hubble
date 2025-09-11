"use client"

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui"
import TextareaAutosize from "react-textarea-autosize"
import { cn } from "@hubble/utils"
import type { ComponentProps, HTMLAttributes, KeyboardEventHandler } from "react"
import { Children } from "react"

type ChatStatus = "ready" | "submitted" | "streaming" | "error"

export type PromptInputProps = HTMLAttributes<HTMLFormElement>
export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      "bg-background w/full divide-y overflow-hidden rounded-xl border shadow-sm",
      className,
    )}
    {...props}
  />
)

export type PromptInputTextareaProps = ComponentProps<typeof TextareaAutosize> & {
  minRows?: number
  maxRows?: number
}
export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know?",
  minRows = 2,
  maxRows = 8,
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return
      if (e.shiftKey) return
      e.preventDefault()
      const form = e.currentTarget.form
      form?.requestSubmit()
    }
  }
  return (
    <TextareaAutosize
      className={cn(
        "w-full resize-none rounded-none border-none p-3 shadow-none ring-0 outline-none",
        "field-sizing-content bg-transparent dark:bg-transparent",
        "focus-visible:ring-0",
        className,
      )}
      minRows={minRows}
      maxRows={maxRows}
      name="message"
      onChange={(e) => onChange?.(e)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  )
}

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>
export const PromptInputToolbar = ({ className, ...props }: PromptInputToolbarProps) => (
  <div className={cn("flex items-center justify-between p-1", className)} {...props} />
)

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>
export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div
    className={cn("flex items-center gap-1", "[&_button:first-child]:rounded-bl-xl", className)}
    {...props}
  />
)

export type PromptInputButtonProps = ComponentProps<typeof Button>
export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize = (size ?? Children.count(props.children) > 1) ? "default" : "icon"
  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5 rounded-lg",
        variant === "ghost" && "text-muted-foreground",
        newSize === "default" && "px-3",
        className,
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  )
}

export type PromptInputSubmitProps = ComponentProps<typeof Button> & { status?: ChatStatus }
export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  return (
    <Button
      className={cn("gap-1.5 rounded-lg", className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children}
    </Button>
  )
}

export type PromptInputModelSelectProps = ComponentProps<typeof Select>
export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => <Select {...props} />

export type PromptInputModelSelectTriggerProps = ComponentProps<typeof SelectTrigger>
export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "text-muted-foreground border-none bg-transparent font-medium shadow-none transition-colors",
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className,
    )}
    {...props}
  />
)

export type PromptInputModelSelectContentProps = ComponentProps<typeof SelectContent>
export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => <SelectContent className={cn(className)} {...props} />

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>
export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => <SelectItem className={cn(className)} {...props} />

export type PromptInputModelSelectValueProps = ComponentProps<typeof SelectValue>
export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => <SelectValue className={cn(className)} {...props} />
