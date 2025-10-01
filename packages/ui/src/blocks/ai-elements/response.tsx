"use client"

import { cn } from "@hubble/utils"
import { type ComponentProps, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ResponseProps = Omit<ComponentProps<typeof ReactMarkdown>, "className"> & {
  className?: string
}

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-p:leading-relaxed prose-pre:p-0",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        "prose-code:before:content-[''] prose-code:after:content-['']",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-ol:my-2 prose-ul:my-2 prose-li:my-0.5",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} {...props}>
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
)

Response.displayName = "Response"
