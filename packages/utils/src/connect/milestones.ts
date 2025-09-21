/**
 * Connect Provisioning Milestones
 *
 * This module defines the 14-milestone progress mapping for the connect
 * provisioning workflow and provides utilities for progress calculation.
 */

import { connect } from "@hubble/api-contracts"

export interface Milestone {
  step: connect.ProvisionStep
  status: connect.ProvisionEventStatus
  index: number
  phase: "Creating database" | "Setting up connection" | "Testing connection" | "All set"
}

/**
 * The 14 milestones in order as they should appear in the progress bar
 */
export const MILESTONES: Milestone[] = [
  { step: "CREATE_SERVICE_ACCOUNT", status: "started", index: 0, phase: "Creating database" },
  { step: "CREATE_SERVICE_ACCOUNT", status: "succeeded", index: 1, phase: "Creating database" },
  { step: "ISSUE_SA_TOKEN", status: "started", index: 2, phase: "Creating database" },
  { step: "ISSUE_SA_TOKEN", status: "succeeded", index: 3, phase: "Creating database" },
  { step: "CREATE_TENANT_DATABASE", status: "started", index: 4, phase: "Creating database" },
  { step: "CREATE_TENANT_DATABASE", status: "succeeded", index: 5, phase: "Creating database" },
  { step: "CONFIGURE_COMPUTE", status: "succeeded", index: 6, phase: "Setting up connection" },
  { step: "CREATE_FIVETRAN_GROUP", status: "started", index: 7, phase: "Setting up connection" },
  { step: "CREATE_FIVETRAN_GROUP", status: "succeeded", index: 8, phase: "Setting up connection" },
  {
    step: "CREATE_FIVETRAN_DESTINATION",
    status: "started",
    index: 9,
    phase: "Setting up connection",
  },
  {
    step: "CREATE_FIVETRAN_DESTINATION",
    status: "succeeded",
    index: 10,
    phase: "Setting up connection",
  },
  { step: "TEST_DESTINATION", status: "started", index: 11, phase: "Testing connection" },
  { step: "TEST_DESTINATION", status: "succeeded", index: 12, phase: "Testing connection" },
  { step: "READY", status: "succeeded", index: 13, phase: "All set" },
]

/**
 * Get the progress percentage (0-100) for a given milestone index
 */
export function getProgressPercentage(milestoneIndex: number): number {
  if (milestoneIndex < 0) return 0
  if (milestoneIndex >= MILESTONES.length) return 100
  return ((milestoneIndex + 1) / MILESTONES.length) * 100
}

/**
 * Find the milestone index for a given step and status
 */
export function findMilestoneIndex(
  step: connect.ProvisionStep,
  status: connect.ProvisionEventStatus,
): number | null {
  const milestone = MILESTONES.find((m) => m.step === step && m.status === status)
  return milestone ? milestone.index : null
}

/**
 * Get the current phase based on the highest completed milestone index
 */
export function getCurrentPhase(milestoneIndex: number): string {
  if (milestoneIndex < 0) return "Starting..."

  const milestone = MILESTONES[milestoneIndex]
  if (!milestone) return "All set"

  return milestone.phase
}

/**
 * Get the highest milestone index that has been completed based on events
 */
export function getHighestCompletedMilestoneIndex(
  events: Array<{
    step: connect.ProvisionStep
    status: connect.ProvisionEventStatus
  }>,
): number {
  let highestIndex = -1

  for (const event of events) {
    const milestoneIndex = findMilestoneIndex(event.step, event.status)
    if (milestoneIndex !== null && milestoneIndex > highestIndex) {
      highestIndex = milestoneIndex
    }
  }

  return highestIndex
}

/**
 * Get the current progress state based on events
 */
export function getProgressState(
  events: Array<{
    step: connect.ProvisionStep
    status: connect.ProvisionEventStatus
  }>,
): {
  percentage: number
  phase: string
  completedMilestones: number
  totalMilestones: number
} {
  const highestIndex = getHighestCompletedMilestoneIndex(events)
  const percentage = getProgressPercentage(highestIndex)
  const phase = getCurrentPhase(highestIndex)
  const completedMilestones = highestIndex + 1
  const totalMilestones = MILESTONES.length

  return {
    percentage,
    phase,
    completedMilestones,
    totalMilestones,
  }
}
