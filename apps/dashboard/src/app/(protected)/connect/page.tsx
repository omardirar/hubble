"use client"

import { ErrorBoundary, useConnect } from "@hubble/ui"
import {
  ConnectContainer,
  ConnectContent,
  ConnectHeader,
  ConnectStatusChecker,
  ConnectEnableButton,
  ConnectLoadingState,
  ConnectSuccessState,
  ConnectErrorState,
} from "@hubble/ui"

export default function Page() {
  const { state, error, handleEnable } = useConnect()

  return (
    <ErrorBoundary>
      <ConnectContainer>
        <ConnectHeader />
        <ConnectContent>
          {state === "checking" && <ConnectStatusChecker />}
          {state === "idle" && <ConnectEnableButton onEnable={handleEnable} />}
          {state === "loading" && <ConnectLoadingState />}
          {state === "ready" && <ConnectSuccessState />}
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
