import type React from "react";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Clock, ArrowRight, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StorageManager } from "../background/storage";
import type { RoomHistoryEntry } from "../background/storage";
import { TypingAnimation } from "../components/TypingAnimation";

interface HomePageProps {
  onCreateRoom: (roomName: string, userName: string) => void;
  onJoinRoom: (
    roomId: string,
    userName: string,
    allowRecreation?: boolean,
  ) => void;
  isLoading?: boolean;
  recentRooms?: RoomHistoryEntry[];
}

export const HomePage: React.FC<HomePageProps> = ({
  onCreateRoom,
  onJoinRoom,
  isLoading = false,
  recentRooms = [],
}) => {
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Limit to maximum 2 recent rooms for space saving
  const displayRooms = recentRooms.slice(0, 2);

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) return;

    setIsJoining(true);

    try {
      const preferences = await StorageManager.getUserPreferences();
      const userName = preferences.defaultUserName || "Guest";

      await onJoinRoom(roomCode.trim(), userName, false);
    } catch (error) {
      console.error("Failed to join room:", error);
      toast({
        title: "Failed to join room",
        description: "Please check the room code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);

    try {
      const preferences = await StorageManager.getUserPreferences();
      const defaultNames = [
        "Movie Night",
        "Watch Party",
        "Cozy Cinema",
        "Fun Hangout",
        "Epic Session",
        "Chill Time",
      ];
      const roomName =
        defaultNames[Math.floor(Math.random() * defaultNames.length)];
      const userName = preferences.defaultUserName || "Guest";

      await onCreateRoom(roomName, userName);

      // The parent component will handle navigation and copying room ID
    } catch (error) {
      console.error("Failed to create room:", error);
      toast({
        title: "Failed to create room",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  };

  const handleRecentRoomClick = async (room: RoomHistoryEntry) => {
    try {
      const preferences = await StorageManager.getUserPreferences();
      const userName = preferences.defaultUserName || "Guest";
      await onJoinRoom(room.id, userName, true);
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  };

  const handleJoinRoomCardClick = (e: React.MouseEvent) => {
    // Don't focus if clicking on the button or input
    if (e.target instanceof HTMLElement) {
      const target = e.target;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.closest("button")
      ) {
        return;
      }
    }

    inputRef.current?.focus();
  };

  return (
    <div className="h-[600px] flex flex-col">
      <div className="p-4 flex-1">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Watch Together</h1>
          <p className="text-muted-foreground text-sm">
            Synchronized video watching with friends
          </p>
        </div>

        {/* Rooms Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Rooms</h2>
          <div className="space-y-3">
            {/* Join Room Card */}
            <div
              className={`rounded-2xl p-4 border-2 shadow-xs transition-all duration-300 cursor-pointer hover:shadow-xs ${
                isHovered
                  ? "bg-green-100/90 border-green-300 shimmer-wave"
                  : "bg-green-50/80 border-green-200"
              }`}
              onClick={handleJoinRoomCardClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Input
                        ref={inputRef}
                        placeholder="Enter room code to join..."
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className={`border-0 shadow-none bg-transparent text-base font-semibold placeholder:text-green-600/70 focus-visible:ring-0 p-0 h-auto transition-all ${
                          isFocused || roomCode
                            ? "text-green-800"
                            : "text-green-700"
                        }`}
                        disabled={isJoining}
                      />
                      {!isFocused && !roomCode && (
                        <div className="absolute inset-0 pointer-events-none">
                          <TypingAnimation
                            text="Enter room code to join..."
                            className="text-base font-semibold text-green-700"
                            speed={120}
                            backspeedMultiplier={4}
                            pauseTime={2500}
                            isHovered={isHovered}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                      <span>Join an existing room</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleJoinRoom}
                  disabled={!roomCode.trim() || isJoining}
                  className="ml-3 rounded-xl bg-green-600 hover:bg-green-700 text-white border-0"
                >
                  {isJoining ? "Joining..." : "Join"}
                </Button>
              </div>
            </div>

            {/* Recent Rooms - Limited to 2 */}
            {displayRooms.length > 0 ? (
              displayRooms.map((room) => {
                // Calculate time ago
                const now = Date.now();
                const lastJoined = room.lastJoined || now;
                const minutesAgo = Math.floor((now - lastJoined) / 60000);
                const hoursAgo = Math.floor(minutesAgo / 60);
                const daysAgo = Math.floor(hoursAgo / 24);

                let timeAgo = "0m ago";
                if (daysAgo > 0) {
                  timeAgo = `${daysAgo}d ago`;
                } else if (hoursAgo > 0) {
                  timeAgo = `${hoursAgo}h ago`;
                } else if (minutesAgo > 0) {
                  timeAgo = `${minutesAgo}m ago`;
                }

                return (
                  <div
                    key={room.id}
                    className="rounded-2xl p-4 border-2 bg-muted/30 border-border hover:bg-muted/50 transition-all cursor-pointer hover:shadow-xs"
                    onClick={() => handleRecentRoomClick(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base truncate">
                            {room.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>by {room.hostName || "Unknown"}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="ml-3 rounded-xl bg-white/70 border-border/50"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecentRoomClick(room);
                        }}
                      >
                        Rejoin
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="rounded-2xl p-6 border-2 border-dashed border-border/50 bg-muted/20">
                <div className="text-center">
                  <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground/70 font-medium">
                    No recent rooms
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    Rooms you&apos;ve joined will appear here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        <Button
          className="w-full h-12 text-base font-medium rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          onClick={handleCreateRoom}
          disabled={isCreating || isLoading}
        >
          <Plus className="w-5 h-5 mr-2" />
          {isCreating ? "Creating Room..." : "Create Room"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-3">
          Create or join a room to watch videos together
        </p>
      </div>
    </div>
  );
};
