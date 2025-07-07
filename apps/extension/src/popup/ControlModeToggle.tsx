/**
 * Control mode toggle component for room host
 */
import React, { useCallback } from "react";
import type { ControlMode } from "@repo/types";

interface ControlModeToggleProps {
  controlMode: ControlMode;
  onToggle: () => void;
  isHost: boolean;
  disabled?: boolean;
}

export const ControlModeToggle: React.FC<ControlModeToggleProps> = ({
  controlMode,
  onToggle,
  isHost,
  disabled = false,
}) => {
  const handleToggle = useCallback(() => {
    if (!disabled && isHost) {
      onToggle();
    }
  }, [disabled, isHost, onToggle]);

  if (!isHost) {
    return null;
  }

  const isHostOnlyMode = controlMode === "HOST_ONLY";

  return (
    <div className="bg-gray-50 p-3 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Control Mode</h4>
          <p className="text-xs text-gray-600 mt-1">
            {isHostOnlyMode
              ? "Only you can control playback"
              : "Everyone can control playback"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isHostOnlyMode ? "bg-gray-400" : "bg-blue-600"
          }`}
          aria-label={`Switch to ${isHostOnlyMode ? "Free-For-All" : "Host-Only"} mode`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isHostOnlyMode ? "translate-x-1" : "translate-x-6"
            }`}
          />
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span
            className={`flex items-center ${isHostOnlyMode ? "text-gray-900 font-medium" : ""}`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1 ${isHostOnlyMode ? "bg-gray-400" : "bg-gray-300"}`}
            />
            Host-Only
          </span>
          <span
            className={`flex items-center ${!isHostOnlyMode ? "text-gray-900 font-medium" : ""}`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1 ${!isHostOnlyMode ? "bg-blue-600" : "bg-gray-300"}`}
            />
            Free-For-All
          </span>
        </div>
      </div>
    </div>
  );
};
