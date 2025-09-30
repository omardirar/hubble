"use client"

import { ErrorBoundary, useConnect } from "@hubble/ui"
import {
  ConnectContainer,
  ConnectContent,
  ConnectStatusChecker,
  ConnectEnableButton,
  ConnectLoadingState,
  ConnectErrorState,
  ConnectSections,
} from "@hubble/ui"

export default function Page() {
  const { state, error, handleEnable } = useConnect()

  return (
    <ErrorBoundary>
      <ConnectContainer>
        <ConnectContent>
          {state === "checking" && <ConnectStatusChecker />}
          {state === "idle" && <ConnectEnableButton onEnable={handleEnable} />}
          {state === "loading" && <ConnectLoadingState />}
          {state === "ready" && <ConnectSections />}
          {state === "error" && (
            <ConnectErrorState
              error={error || "An unknown error occurred"}
              onRetry={handleEnable}
            />
          )}
        </ConnectContent>
      </ConnectContainer>
    </ErrorBoundary>
  )
}
