import { redirect } from "next/navigation"
import { getCurrentOrgId } from "@hubble/auth"
import { getStatusWithTimeline } from "@hubble/utils/connect/api"
import { ConnectPageClient } from "./ConnectPageClient"

interface ConnectPageProps {
  searchParams: Promise<{
    correlation_id?: string
  }>
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const resolvedSearchParams = await searchParams
  const orgId = await getCurrentOrgId()

  if (!orgId) {
    redirect("/sign-in")
  }

  const correlationId = resolvedSearchParams.correlation_id

  // If we have a correlation_id, check the status
  if (correlationId) {
    try {
      const status = await getStatusWithTimeline(correlationId)

      // If ready, redirect to /wip
      if (status.status === "ready") {
        redirect("/wip")
      }

      // If failed or not found, we'll show the enable button
      // If running or pending, we'll show the progress component
      return (
        <ConnectPageClient
          orgId={orgId}
          correlationId={correlationId}
          initialStatus={status.status}
          initialEvents={status.timeline}
        />
      )
    } catch (error) {
      // If we can't get status, treat as not found and show enable button
      console.error("Failed to get status:", error)
    }
  }

  // No correlation_id or failed to get status - show enable button
  return <ConnectPageClient orgId={orgId} />
}
