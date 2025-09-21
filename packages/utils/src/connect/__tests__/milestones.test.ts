/**
 * Tests for Connect Milestones
 */

import { describe, it, expect } from "vitest"
import {
  MILESTONES,
  getProgressPercentage,
  findMilestoneIndex,
  getCurrentPhase,
  getHighestCompletedMilestoneIndex,
  getProgressState,
} from "../milestones"
import { connect } from "@hubble/api-contracts"

describe("Connect Milestones", () => {
  describe("MILESTONES array", () => {
    it("should have exactly 14 milestones", () => {
      expect(MILESTONES).toHaveLength(14)
    })

    it("should have milestones in correct order", () => {
      const expectedSteps = [
        "CREATE_SERVICE_ACCOUNT",
        "CREATE_SERVICE_ACCOUNT",
        "ISSUE_SA_TOKEN",
        "ISSUE_SA_TOKEN",
        "CREATE_TENANT_DATABASE",
        "CREATE_TENANT_DATABASE",
        "CONFIGURE_COMPUTE",
        "CREATE_FIVETRAN_GROUP",
        "CREATE_FIVETRAN_GROUP",
        "CREATE_FIVETRAN_DESTINATION",
        "CREATE_FIVETRAN_DESTINATION",
        "TEST_DESTINATION",
        "TEST_DESTINATION",
        "READY",
      ]

      const actualSteps = MILESTONES.map((m) => m.step)
      expect(actualSteps).toEqual(expectedSteps)
    })

    it("should have correct statuses", () => {
      const expectedStatuses = [
        "started",
        "succeeded",
        "started",
        "succeeded",
        "started",
        "succeeded",
        "succeeded",
        "started",
        "succeeded",
        "started",
        "succeeded",
        "started",
        "succeeded",
        "succeeded",
      ]

      const actualStatuses = MILESTONES.map((m) => m.status)
      expect(actualStatuses).toEqual(expectedStatuses)
    })
  })

  describe("getProgressPercentage", () => {
    it("should return 0 for negative index", () => {
      expect(getProgressPercentage(-1)).toBe(0)
    })

    it("should return 100 for index >= length", () => {
      expect(getProgressPercentage(14)).toBe(100)
      expect(getProgressPercentage(100)).toBe(100)
    })

    it("should return correct percentages for valid indices", () => {
      expect(getProgressPercentage(0)).toBeCloseTo(7.14, 1) // 1/14 * 100
      expect(getProgressPercentage(6)).toBeCloseTo(50, 1) // 7/14 * 100
      expect(getProgressPercentage(13)).toBe(100) // 14/14 * 100
    })
  })

  describe("findMilestoneIndex", () => {
    it("should find correct milestone index", () => {
      expect(findMilestoneIndex("CREATE_SERVICE_ACCOUNT", "started")).toBe(0)
      expect(findMilestoneIndex("CREATE_SERVICE_ACCOUNT", "succeeded")).toBe(1)
      expect(findMilestoneIndex("READY", "succeeded")).toBe(13)
    })

    it("should return null for non-existent combinations", () => {
      expect(findMilestoneIndex("CREATE_SERVICE_ACCOUNT", "failed")).toBeNull()
      // @ts-expect-error - testing invalid step
      expect(findMilestoneIndex("NON_EXISTENT", "started")).toBeNull()
    })
  })

  describe("getCurrentPhase", () => {
    it("should return correct phases", () => {
      expect(getCurrentPhase(-1)).toBe("Starting...")
      expect(getCurrentPhase(0)).toBe("Creating database")
      expect(getCurrentPhase(5)).toBe("Creating database")
      expect(getCurrentPhase(6)).toBe("Setting up connection")
      expect(getCurrentPhase(10)).toBe("Setting up connection")
      expect(getCurrentPhase(11)).toBe("Testing connection")
      expect(getCurrentPhase(13)).toBe("All set")
      expect(getCurrentPhase(14)).toBe("All set")
    })
  })

  describe("getHighestCompletedMilestoneIndex", () => {
    it("should return -1 for empty events", () => {
      expect(getHighestCompletedMilestoneIndex([])).toBe(-1)
    })

    it("should find highest completed milestone", () => {
      const events = [
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "started" as const },
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "succeeded" as const },
        { step: "ISSUE_SA_TOKEN" as const, status: "started" as const },
      ]

      expect(getHighestCompletedMilestoneIndex(events)).toBe(1) // CREATE_SERVICE_ACCOUNT succeeded
    })

    it("should handle out-of-order events", () => {
      const events = [
        { step: "ISSUE_SA_TOKEN" as const, status: "succeeded" as const },
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "started" as const },
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "succeeded" as const },
      ]

      expect(getHighestCompletedMilestoneIndex(events)).toBe(3) // ISSUE_SA_TOKEN succeeded
    })
  })

  describe("getProgressState", () => {
    it("should return correct state for empty events", () => {
      const state = getProgressState([])
      expect(state.percentage).toBe(0)
      expect(state.phase).toBe("Starting...")
      expect(state.completedMilestones).toBe(0)
      expect(state.totalMilestones).toBe(14)
    })

    it("should return correct state for partial progress", () => {
      const events = [
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "started" as const },
        { step: "CREATE_SERVICE_ACCOUNT" as const, status: "succeeded" as const },
        { step: "ISSUE_SA_TOKEN" as const, status: "started" as const },
      ]

      const state = getProgressState(events)
      expect(state.percentage).toBeCloseTo(14.29, 1) // 2/14 * 100
      expect(state.phase).toBe("Creating database")
      expect(state.completedMilestones).toBe(2)
      expect(state.totalMilestones).toBe(14)
    })

    it("should return correct state for complete progress", () => {
      const events = [{ step: "READY" as const, status: "succeeded" as const }]

      const state = getProgressState(events)
      expect(state.percentage).toBe(100)
      expect(state.phase).toBe("All set")
      expect(state.completedMilestones).toBe(14)
      expect(state.totalMilestones).toBe(14)
    })
  })
})
