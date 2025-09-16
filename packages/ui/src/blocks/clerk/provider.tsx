"use client"

import { ClerkProvider as ClerkNextJSProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

type ClerkProviderProps = React.ComponentProps<typeof ClerkNextJSProvider>

export function ClerkProvider({ children, appearance, ...props }: ClerkProviderProps) {
  return (
    <ClerkNextJSProvider
      appearance={{
        baseTheme: shadcn,
        ...appearance,
      }}
      {...props}
    >
      {children}
    </ClerkNextJSProvider>
  )
}
