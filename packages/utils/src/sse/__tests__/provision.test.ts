/**
 * Tests for SSE Provision Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getLastEventSeq, clearLastEventSeq } from "../provision"

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
})

describe("SSE Provision Client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getLastEventSeq", () => {
    it("should return undefined when no stored value", () => {
      mockSessionStorage.getItem.mockReturnValue(null)

      const result = getLastEventSeq("org123", "corr456")

      expect(result).toBeUndefined()
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        "hubble:connect:last_event_seq:org123:corr456",
      )
    })

    it("should return parsed number when stored value exists", () => {
      mockSessionStorage.getItem.mockReturnValue("42")

      const result = getLastEventSeq("org123", "corr456")

      expect(result).toBe(42)
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
        "hubble:connect:last_event_seq:org123:corr456",
      )
    })

    it("should return undefined for invalid stored value", () => {
      mockSessionStorage.getItem.mockReturnValue("invalid")

      const result = getLastEventSeq("org123", "corr456")

      expect(result).toBeUndefined()
    })
  })

  describe("clearLastEventSeq", () => {
    it("should remove stored value", () => {
      clearLastEventSeq("org123", "corr456")

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "hubble:connect:last_event_seq:org123:corr456",
      )
    })
  })
})
