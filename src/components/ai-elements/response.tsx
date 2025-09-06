"use client"

import { cn } from "@/lib/utils"
import { type ComponentProps, type ReactNode, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ResponseProps = Omit<ComponentProps<typeof ReactMarkdown>, "className"> & {
  className?: string
  children?: ReactNode
}

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <div className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} {...props} />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
)

// TODO: Add a11y: ensure headings have a logical order; provide landmark roles
//  labels: area:ui, accessibility, P3
//  assignees: me
//  milestone: M3 - Perf & DX
//  evidence: src/components/ai-elements/response.tsx — renders markdown without a11y audit

Response.displayName = "Response"
