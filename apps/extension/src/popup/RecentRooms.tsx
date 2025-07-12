/**
 * Recent rooms component for Watch Together popup
 */
import React, { useState, useEffect, useCallback } from "react";
import type { RoomHistoryEntry } from "../background/storage";
import { StorageManager } from "../background/storage";

interface RecentRoomsProps {
  onJoinRoom: (roomId: string, userName: string) => Promise<void>;
}

export const RecentRooms: React.FC<RecentRoomsProps> = ({ onJoinRoom }) => {
  const [recentRooms, setRecentRooms] = useState<RoomHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // Load recent rooms on mount
  useEffect(() => {
    const loadRecentRooms = async () => {
      try {
        const rooms = await StorageManager.getRoomHistory();
        setRecentRooms(rooms.slice(0, 3)); // Show only last 3 rooms
      } catch (error) {
        console.error("Failed to load recent rooms:", error);
      }
    };

    loadRecentRooms();
  }, []);

  const handleQuickJoin = useCallback(
    async (room: RoomHistoryEntry) => {
      setIsLoading(true);
      setJoiningRoomId(room.id);

      try {
        // Use stored user preferences for default name
        const preferences = await StorageManager.getUserPreferences();
        const userName = preferences.defaultUserName || "Guest";

        await onJoinRoom(room.id, userName);
      } catch (error) {
        console.error("Failed to rejoin room:", error);
      } finally {
        setIsLoading(false);
        setJoiningRoomId(null);
      }
    },
    [onJoinRoom],
  );

  const formatLastJoined = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }, []);

  if (recentRooms.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Rooms</h3>
      <div className="space-y-2">
        {recentRooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200 hover:bg-gray-50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {room.name}
              </p>
              <p className="text-xs text-gray-500">
                by {room.hostName} • {formatLastJoined(room.lastJoined)}
              </p>
            </div>
            <button
              onClick={() => handleQuickJoin(room)}
              disabled={isLoading}
              className={`ml-2 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                joiningRoomId === room.id
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {joiningRoomId === room.id ? "Joining..." : "Join"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
