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
import { EditableRoomName } from "./EditableRoomName";
import { EditableUserName } from "./EditableUserName";

// Icon components
const PlayIcon: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

// Progress bar component
const VideoProgressBar: React.FC<{ currentTime: number; duration: number }> = ({
  currentTime,
  duration,
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
      <div
        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
};

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
  onRenameUser: (newUserName: string) => void;
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
  onRenameUser,
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
    if (seconds === 0 || !isFinite(seconds)) {
      return "--:--";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleVideoUrlClick = useCallback((url: string) => {
    window.open(url, "_blank");
  }, []);

  const handleRename = useCallback(async (newName: string) => {
    try {
      // Send message without waiting for response (fire-and-forget)
      chrome.runtime
        .sendMessage({
          type: "RENAME_ROOM",
          newRoomName: newName,
          timestamp: Date.now(),
        })
        .catch(() => {
          // Expected - Chrome extension messaging timeout, but operation still succeeds
        });

      // The UI will update automatically when the ROOM_RENAMED WebSocket event
      // is received and processed by the background script's handleRoomRenamed
    } catch (error) {
      console.error("Failed to send rename request:", error);
      throw error;
    }
  }, []);

  const handleUserRename = useCallback(
    async (newName: string) => {
      try {
        // Use the prop function passed from parent
        await onRenameUser(newName);
      } catch (error) {
        console.error("Failed to send user rename request:", error);
        throw error;
      }
    },
    [onRenameUser],
  );

  return (
    <div className="p-4 h-full flex flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Watch Together</h2>
        <button
          onClick={onLeaveRoom}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Leave Room
        </button>
      </div>

      {/* Room Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <EditableRoomName
            currentName={room.name}
            onRename={handleRename}
            disabled={!currentUser.isHost}
          />
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

      {/* Host Current Location (for participants only) */}
      {!currentUser.isHost && room.hostCurrentUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-shrink-0">
          <h4 className="font-medium text-gray-900 mb-2">
            Host is currently on
          </h4>
          <div className="text-sm text-gray-600 mb-2">
            <div className="truncate">{room.hostCurrentUrl}</div>
          </div>
          <button
            onClick={() => window.open(room.hostCurrentUrl!, "_blank")}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Open in new tab →
          </button>
        </div>
      )}

      {/* Video State - Show host's video for participants, own video for host */}
      {currentUser.isHost
        ? room.videoState.url && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex-shrink-0">
              <h4 className="font-medium text-gray-900 mb-2">Your Video</h4>
              <div className="text-sm text-gray-600 mb-2">
                <button
                  onClick={() => handleVideoUrlClick(room.videoState.url!)}
                  className="text-blue-600 hover:text-blue-800 hover:underline truncate w-full text-left"
                  title={room.videoState.url}
                >
                  {room.videoState.url}
                </button>
              </div>
              <VideoProgressBar
                currentTime={room.videoState.currentTime}
                duration={room.videoState.duration}
              />
              <div className="flex items-center justify-between text-sm">
                <span
                  className={`flex items-center gap-1 ${room.videoState.isPlaying ? "text-green-600" : "text-gray-600"}`}
                >
                  {room.videoState.isPlaying ? (
                    <PlayIcon className="w-3 h-3" />
                  ) : (
                    <PauseIcon className="w-3 h-3" />
                  )}
                  {room.videoState.isPlaying ? "Playing" : "Paused"}
                </span>
                <span className="text-gray-500">
                  {formatTime(room.videoState.currentTime)} /{" "}
                  {formatTime(room.videoState.duration)}
                </span>
              </div>
            </div>
          )
        : room.hostVideoState?.url && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex-shrink-0">
              <h4 className="font-medium text-gray-900 mb-2">
                Host&apos;s Video
              </h4>
              <div className="text-sm text-gray-600 mb-2">
                <button
                  onClick={() => handleVideoUrlClick(room.hostVideoState!.url!)}
                  className="text-blue-600 hover:text-blue-800 hover:underline truncate w-full text-left"
                  title={room.hostVideoState.url}
                >
                  {room.hostVideoState.url}
                </button>
              </div>
              <VideoProgressBar
                currentTime={room.hostVideoState.currentTime}
                duration={room.hostVideoState.duration}
              />
              <div className="flex items-center justify-between text-sm">
                <span
                  className={`flex items-center gap-1 ${room.hostVideoState.isPlaying ? "text-green-600" : "text-gray-600"}`}
                >
                  {room.hostVideoState.isPlaying ? (
                    <PlayIcon className="w-3 h-3" />
                  ) : (
                    <PauseIcon className="w-3 h-3" />
                  )}
                  {room.hostVideoState.isPlaying ? "Playing" : "Paused"}
                </span>
                <span className="text-gray-500">
                  {formatTime(room.hostVideoState.currentTime)} /{" "}
                  {formatTime(room.hostVideoState.duration)}
                </span>
              </div>
            </div>
          )}

      {/* Control Mode Toggle (Host Only) */}
      <div className="flex-shrink-0">
        <ControlModeToggle
          controlMode={room.controlMode}
          onToggle={onToggleControlMode}
          isHost={currentUser.isHost}
          disabled={connectionStatus !== "CONNECTED"}
        />
      </div>

      {/* Follow Mode Toggle */}
      <div className="flex-shrink-0">
        <FollowModeToggle
          followMode={followMode}
          onToggle={onToggleFollowMode}
          disabled={connectionStatus !== "CONNECTED"}
          hasFollowNotification={hasFollowNotification}
          onFollowHost={onFollowHost}
          isHost={currentUser.isHost}
        />
      </div>

      {/* Participants */}
      <div
        className="flex-1 bg-white border border-gray-200 rounded-lg p-3 flex flex-col"
        style={{ minHeight: "120px" }}
      >
        <h4 className="font-medium text-gray-900 mb-3 flex-shrink-0">
          Participants ({connectedUsers.length})
        </h4>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-2">
            {connectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <EditableUserName
                    currentName={user.name}
                    onRename={handleUserRename}
                    isCurrentUser={user.id === currentUser.id}
                    disabled={false}
                  />
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
    </div>
  );
};
