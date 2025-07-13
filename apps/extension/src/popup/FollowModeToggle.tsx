/**
 * Follow mode toggle component for navigation preferences
 */
import React, { useCallback } from "react";
import type { FollowMode } from "@repo/types";

interface FollowModeToggleProps {
  followMode: FollowMode;
  onToggle: () => void;
  disabled?: boolean;
  hasFollowNotification?: boolean;
  onFollowHost?: () => void;
  isHost?: boolean;
}

export const FollowModeToggle: React.FC<FollowModeToggleProps> = ({
  followMode,
  onToggle,
  disabled = false,
  hasFollowNotification = false,
  onFollowHost,
  isHost = false,
}) => {
  const handleToggle = useCallback(() => {
    if (!disabled) {
      onToggle();
    }
  }, [disabled, onToggle]);

  const handleFollowHost = useCallback(() => {
    if (onFollowHost) {
      onFollowHost();
    }
  }, [onFollowHost]);

  // Don't show navigation controls for hosts
  if (isHost) {
    return null;
  }

  const isAutoFollow = followMode === "AUTO_FOLLOW";

  return (
    <div className="bg-gray-50 p-3 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Navigation</h4>
          <p className="text-xs text-gray-600 mt-1">
            {isAutoFollow
              ? "Automatically follow host to new videos"
              : "Manually choose when to follow host"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isAutoFollow ? "bg-blue-600" : "bg-gray-400"
          }`}
          aria-label={`Switch to ${isAutoFollow ? "Manual" : "Auto"} follow mode`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isAutoFollow ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span
            className={`flex items-center ${isAutoFollow ? "text-gray-900 font-medium" : ""}`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1 ${isAutoFollow ? "bg-blue-600" : "bg-gray-300"}`}
            />
            Auto-follow
          </span>
          <span
            className={`flex items-center ${!isAutoFollow ? "text-gray-900 font-medium" : ""}`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1 ${!isAutoFollow ? "bg-gray-400" : "bg-gray-300"}`}
            />
            Manual
          </span>
        </div>
      </div>

      {hasFollowNotification && !isAutoFollow && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-sm text-gray-700">
                Host moved to new video
              </span>
            </div>
            <button
              onClick={handleFollowHost}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Follow Host
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
