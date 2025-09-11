import {
  Badge,
  Carousel,
  CarouselContent,
  CarouselItem,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../ui"
import { cn } from "@hubble/utils"
import type { ComponentProps } from "react"

export type InlineCitationProps = ComponentProps<typeof HoverCard>
export const InlineCitation = (props: InlineCitationProps) => <HoverCard {...props} />

export type InlineCitationTriggerProps = ComponentProps<typeof HoverCardTrigger>
export const InlineCitationTrigger = ({
  className,
  children,
  ...props
}: InlineCitationTriggerProps) => (
  <HoverCardTrigger className={cn("text-primary hover:underline", className)} {...props}>
    {children}
  </HoverCardTrigger>
)

export type InlineCitationContentProps = ComponentProps<typeof HoverCardContent>
export const InlineCitationContent = ({
  className,
  children,
  ...props
}: InlineCitationContentProps) => (
  <HoverCardContent className={cn("w-[320px]", className)} {...props}>
    <Carousel>
      <CarouselContent>
        <CarouselItem>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Source</Badge>
            {children}
          </div>
        </CarouselItem>
      </CarouselContent>
    </Carousel>
  </HoverCardContent>
)
