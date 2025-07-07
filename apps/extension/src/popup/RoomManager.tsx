/**
 * Room manager component showing active room state and participants
 */
import React, { useMemo, useCallback } from "react";
import type {
  RoomState,
  User,
  ConnectionStatus,
  FollowMode,
} from "@repo/types";
import { ControlModeToggle } from "./ControlModeToggle";
import { FollowModeToggle } from "./FollowModeToggle";

interface RoomManagerProps {
  room: RoomState;
  currentUser: User;
  connectionStatus: ConnectionStatus;
  followMode: FollowMode;
  hasFollowNotification?: boolean;
  onLeaveRoom: () => void;
  onToggleControlMode: () => void;
  onToggleFollowMode: () => void;
  onFollowHost: () => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  room,
  currentUser,
  connectionStatus,
  followMode,
  hasFollowNotification = false,
  onLeaveRoom,
  onToggleControlMode,
  onToggleFollowMode,
  onFollowHost,
}) => {
  const connectedUsers = useMemo(() => {
    return room.users.filter((user) => user.isConnected);
  }, [room.users]);

  const connectionStatusDisplay = useMemo(() => {
    switch (connectionStatus) {
      case "CONNECTED":
        return { text: "Connected", color: "text-green-600", icon: "●" };
      case "CONNECTING":
        return { text: "Connecting", color: "text-yellow-600", icon: "●" };
      case "RECONNECTING":
        return { text: "Reconnecting", color: "text-yellow-600", icon: "●" };
      case "DISCONNECTED":
        return { text: "Disconnected", color: "text-red-600", icon: "●" };
      case "ERROR":
        return { text: "Error", color: "text-red-600", icon: "●" };
      default:
        return { text: "Unknown", color: "text-gray-600", icon: "●" };
    }
  }, [connectionStatus]);

  const handleCopyRoomId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      // Could show a toast notification here
    } catch (err) {
      console.error("Failed to copy room ID:", err);
    }
  }, [room.id]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Watch Together</h2>
        <button
          onClick={onLeaveRoom}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Leave Room
        </button>
      </div>

      {/* Room Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900">{room.name}</h3>
          <span className={`text-xs ${connectionStatusDisplay.color}`}>
            {connectionStatusDisplay.icon} {connectionStatusDisplay.text}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Room ID: {room.id}</span>
          <button
            onClick={handleCopyRoomId}
            className="text-blue-600 hover:text-blue-800 text-xs"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Video State */}
      {room.videoState.url && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Current Video</h4>
          <div className="text-sm text-gray-600 mb-2">
            <div className="truncate">{room.videoState.url}</div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span
              className={`flex items-center ${room.videoState.isPlaying ? "text-green-600" : "text-gray-600"}`}
            >
              {room.videoState.isPlaying ? "▶️" : "⏸️"}
              {room.videoState.isPlaying ? "Playing" : "Paused"}
            </span>
            <span className="text-gray-500">
              {formatTime(room.videoState.currentTime)} /{" "}
              {formatTime(room.videoState.duration)}
            </span>
          </div>
        </div>
      )}

      {/* Control Mode Toggle (Host Only) */}
      <div className="mb-4">
        <ControlModeToggle
          controlMode={room.controlMode}
          onToggle={onToggleControlMode}
          isHost={currentUser.isHost}
          disabled={connectionStatus !== "CONNECTED"}
        />
      </div>

      {/* Follow Mode Toggle */}
      <div className="mb-4">
        <FollowModeToggle
          followMode={followMode}
          onToggle={onToggleFollowMode}
          disabled={connectionStatus !== "CONNECTED"}
          hasFollowNotification={hasFollowNotification}
          onFollowHost={onFollowHost}
        />
      </div>

      {/* Participants */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="font-medium text-gray-900 mb-3">
          Participants ({connectedUsers.length})
        </h4>
        <div className="space-y-2">
          {connectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-900">{user.name}</span>
                {user.isHost && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Host
                  </span>
                )}
                {user.id === currentUser.id && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                    You
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
