/**
 * BadgeManager tests
 * Ensures extension badge properly displays participant count and connection status
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadgeManager } from "../badgeManager";
import { setupChromeGlobal, resetChromeMocks } from "../../test-utils/chrome-mocks";
import type { ConnectionStatus } from "@repo/types";

describe("BadgeManager", () => {
  let badgeManager: BadgeManager;
  let chromeMock: ReturnType<typeof setupChromeGlobal>;

  beforeEach(() => {
    // Setup Chrome API mocks
    chromeMock = setupChromeGlobal();
    resetChromeMocks(chromeMock);
    
    // Create new BadgeManager instance
    badgeManager = new BadgeManager();
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      const currentBadge = badgeManager.getCurrentBadge();
      
      expect(currentBadge).toEqual({
        count: 0,
        status: "DISCONNECTED",
        visible: false,
      });
    });

    it("should set initial badge background color and clear text", async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: "#9E9E9E", // DISCONNECTED color
      });
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    });

    it("should handle initialization errors gracefully", async () => {
      // Create a new BadgeManager with failing mock
      resetChromeMocks(chromeMock);
      chromeMock.action.setBadgeBackgroundColor.mockRejectedValue(new Error("Mock error"));
      
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      // Create instance - should not throw
      expect(() => new BadgeManager()).not.toThrow();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BadgeManager] Failed to initialize badge:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("updateBadge", () => {
    it("should update badge text and color for connected state", async () => {
      await badgeManager.updateBadge(3, "CONNECTED", true);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
      expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: "#4CAF50", // CONNECTED color
      });
      
      const currentBadge = badgeManager.getCurrentBadge();
      expect(currentBadge.count).toBe(3);
      expect(currentBadge.status).toBe("CONNECTED");
      expect(currentBadge.visible).toBe(true);
    });

    it("should display '...' for connecting state", async () => {
      await badgeManager.updateBadge(0, "CONNECTING", true);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "..." });
      expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: "#FF9800", // CONNECTING color
      });
    });

    it("should display '999+' for counts over 999", async () => {
      await badgeManager.updateBadge(1500, "CONNECTED", true);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "999+" });
    });

    it("should hide badge when visible is false", async () => {
      await badgeManager.updateBadge(5, "CONNECTED", false);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
      
      const currentBadge = badgeManager.getCurrentBadge();
      expect(currentBadge.visible).toBe(false);
    });

    it("should skip update if state hasn't changed", async () => {
      // First update
      await badgeManager.updateBadge(3, "CONNECTED", true);
      
      // Reset mocks to check if second update is skipped
      resetChromeMocks(chromeMock);
      
      // Same state update
      await badgeManager.updateBadge(3, "CONNECTED", true);
      
      // Should not have called Chrome APIs again
      expect(chromeMock.action.setBadgeText).not.toHaveBeenCalled();
      expect(chromeMock.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    });

    it("should handle update errors gracefully", async () => {
      chromeMock.action.setBadgeText.mockRejectedValue(new Error("Update failed"));
      
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      await badgeManager.updateBadge(3, "CONNECTED", true);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BadgeManager] Failed to update badge:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it("should update for each connection status color", async () => {
      const statusTests: Array<{ status: ConnectionStatus; expectedColor: string }> = [
        { status: "CONNECTED", expectedColor: "#4CAF50" },
        { status: "CONNECTING", expectedColor: "#FF9800" },
        { status: "ERROR", expectedColor: "#F44336" },
        { status: "DISCONNECTED", expectedColor: "#9E9E9E" },
      ];

      for (const test of statusTests) {
        resetChromeMocks(chromeMock);
        await badgeManager.updateBadge(1, test.status, true);
        
        expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
          color: test.expectedColor,
        });
      }
    });
  });

  describe("clearBadge", () => {
    it("should clear badge text and reset state", async () => {
      // First set a badge
      await badgeManager.updateBadge(5, "CONNECTED", true);
      
      // Then clear it
      await badgeManager.clearBadge();
      
      expect(chromeMock.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
      
      const currentBadge = badgeManager.getCurrentBadge();
      expect(currentBadge).toEqual({
        count: 0,
        status: "DISCONNECTED",
        visible: false,
      });
    });

    it("should handle clear errors gracefully", async () => {
      chromeMock.action.setBadgeText.mockRejectedValue(new Error("Clear failed"));
      
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      await badgeManager.clearBadge();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BadgeManager] Failed to clear badge:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("showError", () => {
    it("should display error badge with exclamation mark", async () => {
      await badgeManager.showError();
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
      expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: "#F44336", // ERROR color
      });
      
      const currentBadge = badgeManager.getCurrentBadge();
      expect(currentBadge.status).toBe("ERROR");
      expect(currentBadge.visible).toBe(true);
    });

    it("should handle error display errors gracefully", async () => {
      chromeMock.action.setBadgeText.mockRejectedValue(new Error("Error display failed"));
      
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      await badgeManager.showError();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BadgeManager] Failed to show error:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle zero participant count correctly", async () => {
      await badgeManager.updateBadge(0, "CONNECTED", true);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "0" });
    });

    it("should handle negative participant count correctly", async () => {
      await badgeManager.updateBadge(-1, "CONNECTED", true);
      
      expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "-1" });
    });

    it("should return independent copy of current badge state", () => {
      const badge1 = badgeManager.getCurrentBadge();
      const badge2 = badgeManager.getCurrentBadge();
      
      expect(badge1).toEqual(badge2);
      expect(badge1).not.toBe(badge2); // Different object instances
      
      // Modifying returned object shouldn't affect internal state
      badge1.count = 999;
      expect(badgeManager.getCurrentBadge().count).toBe(0);
    });
  });
});