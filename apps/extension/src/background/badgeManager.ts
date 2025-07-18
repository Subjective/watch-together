/**
 * Badge Manager for Watch Together extension
 * Handles extension icon badge updates to display participant count
 */

import type { ConnectionStatus } from "@repo/types";

export interface BadgeState {
  count: number;
  status: ConnectionStatus;
  visible: boolean;
}

export class BadgeManager {
  private currentBadge: BadgeState = {
    count: 0,
    status: "DISCONNECTED",
    visible: false,
  };

  private readonly colors = {
    CONNECTED: "#4CAF50", // Green
    CONNECTING: "#FF9800", // Orange
    ERROR: "#F44336", // Red
    DISCONNECTED: "#9E9E9E", // Gray
  };

  constructor() {
    this.initializeBadge();
  }

  /**
   * Initialize badge settings
   */
  private async initializeBadge(): Promise<void> {
    try {
      // Set initial badge background color
      await chrome.action.setBadgeBackgroundColor({
        color: this.colors.DISCONNECTED,
      });

      // Clear badge initially
      await chrome.action.setBadgeText({ text: "" });

      console.log("[BadgeManager] Badge initialized");
    } catch (error) {
      console.error("[BadgeManager] Failed to initialize badge:", error);
    }
  }

  /**
   * Update badge with participant count and connection status
   */
  async updateBadge(
    participantCount: number,
    connectionStatus: ConnectionStatus,
    showBadge: boolean = true,
  ): Promise<void> {
    try {
      const newBadge: BadgeState = {
        count: participantCount,
        status: connectionStatus,
        visible: showBadge,
      };

      // Only update if state has changed
      if (this.hasStateChanged(newBadge)) {
        await this.applyBadgeUpdate(newBadge);
        this.currentBadge = newBadge;
      }
    } catch (error) {
      console.error("[BadgeManager] Failed to update badge:", error);
    }
  }

  /**
   * Clear badge (when leaving room or disconnected)
   */
  async clearBadge(): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text: "" });

      this.currentBadge = {
        count: 0,
        status: "DISCONNECTED",
        visible: false,
      };

      console.log("[BadgeManager] Badge cleared");
    } catch (error) {
      console.error("[BadgeManager] Failed to clear badge:", error);
    }
  }

  /**
   * Show error state on badge
   */
  async showError(): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({
        color: this.colors.ERROR,
      });

      this.currentBadge = {
        count: 0,
        status: "ERROR",
        visible: true,
      };

      console.log("[BadgeManager] Error state displayed");
    } catch (error) {
      console.error("[BadgeManager] Failed to show error:", error);
    }
  }

  /**
   * Get current badge state
   */
  getCurrentBadge(): BadgeState {
    return { ...this.currentBadge };
  }

  /**
   * Check if badge state has changed
   */
  private hasStateChanged(newBadge: BadgeState): boolean {
    return (
      this.currentBadge.count !== newBadge.count ||
      this.currentBadge.status !== newBadge.status ||
      this.currentBadge.visible !== newBadge.visible
    );
  }

  /**
   * Apply badge update to Chrome extension
   */
  private async applyBadgeUpdate(badgeState: BadgeState): Promise<void> {
    // Update badge text
    const badgeText = this.getBadgeText(badgeState);
    await chrome.action.setBadgeText({ text: badgeText });

    // Update badge color
    const badgeColor = this.colors[badgeState.status];
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });

    console.log(
      `[BadgeManager] Badge updated: ${badgeText} (${badgeState.status})`,
    );
  }

  /**
   * Get badge text based on state
   */
  private getBadgeText(badgeState: BadgeState): string {
    if (!badgeState.visible) {
      return "";
    }

    switch (badgeState.status) {
      case "CONNECTED":
        // Show participant count for connected state
        return badgeState.count > 999 ? "999+" : String(badgeState.count);

      case "CONNECTING":
        return "...";

      case "ERROR":
        return "!";

      case "DISCONNECTED":
      default:
        return "";
    }
  }
}
