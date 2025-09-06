import { cn } from "@/lib/utils"

export type ImageProps = {
  base64: string
  mediaType: string
  className?: string
  alt?: string
}

export const Image = ({ base64, mediaType, alt, className }: ImageProps) => (
  /* eslint-disable-next-line @next/next/no-img-element */
  <img
    alt={alt}
    className={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
    src={`data:${mediaType};base64,${base64}`}
  />
)
