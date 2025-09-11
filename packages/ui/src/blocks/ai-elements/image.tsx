import { cn } from "@hubble/utils"

export type ImageProps = { base64: string; mediaType: string; className?: string; alt?: string }
export const Image = ({ base64, mediaType, alt, className }: ImageProps) => (
  <img
    alt={alt}
    className={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
    src={`data:${mediaType};base64,${base64}`}
  />
)
