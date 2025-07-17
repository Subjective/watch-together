import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  Users,
  Crown,
  Copy,
  Lock,
  Unlock,
  MoreHorizontal,
  Wifi,
  Eye,
  EyeOff,
  ArrowLeft,
  Settings,
  Flag,
  Heart,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type {
  RoomState,
  User,
  ConnectionStatus,
  FollowMode,
} from "@repo/types";

interface RoomPageProps {
  room: RoomState;
  currentUser: User;
  connectionStatus: ConnectionStatus;
  followMode: FollowMode;
  hasFollowNotification: boolean;
  onNavigateToHome: () => void;
  onLeaveRoom: () => void;
  onToggleControlMode: () => void;
  onToggleFollowMode: () => void;
  onFollowHost: () => void;
  onRenameUser?: (newName: string) => void;
  onRenameRoom?: (newName: string) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({
  room,
  currentUser,
  connectionStatus,
  followMode,
  hasFollowNotification,
  onNavigateToHome,
  onLeaveRoom,
  onToggleControlMode,
  onToggleFollowMode,
  onFollowHost,
  onRenameUser,
  onRenameRoom,
}) => {
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [roomName, setRoomName] = useState(room.name);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [userName, setUserName] = useState(currentUser.name);

  // Calculate isHost dynamically based on current room state
  const isHost = currentUser.id === room.hostId;
  const isControlMode = room.controlMode === "HOST_ONLY";
  const isConnected = connectionStatus === "CONNECTED";
  const hostUser = room.users.find((u) => u.id === room.hostId);
  const isFollowingHost = followMode === "AUTO_FOLLOW" && !isHost;

  // Sync room name when room changes
  useEffect(() => {
    setRoomName(room.name);
  }, [room.name]);

  // Sync user name when current user changes
  useEffect(() => {
    setUserName(currentUser.name);
  }, [currentUser.name]);

  // Cancel room name editing if user loses host status
  useEffect(() => {
    if (!isHost && isEditingRoomName) {
      setIsEditingRoomName(false);
      setRoomName(room.name);
    }
  }, [isHost, room.name, isEditingRoomName]);

  // Video state
  const videoState = room.videoState;
  const isPaused = !videoState.isPlaying;
  const progress =
    videoState.duration > 0
      ? (videoState.currentTime / videoState.duration) * 100
      : 0;

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      toast({
        title: "Copied!",
        description: "Room ID copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy manually: " + room.id,
      });
    }
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case "settings":
        toast({
          title: "Settings",
          description: "Settings panel coming soon!",
        });
        break;
      case "report":
        toast({
          title: "Report Issue",
          description: "Report functionality coming soon!",
        });
        break;
      case "donate":
        toast({
          title: "Support",
          description: "Thank you for your interest in supporting us!",
        });
        break;
    }
  };

  const handleLeaveRoom = () => {
    onLeaveRoom();
    onNavigateToHome();
  };

  return (
    <div className="h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
            onClick={onNavigateToHome}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-xl">Watch Together</h1>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-2 h-auto rounded-full"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleMenuAction("settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuAction("report")}>
                <Flag className="w-4 h-4 mr-2" />
                Report Issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuAction("donate")}>
                <Heart className="w-4 h-4 mr-2" />
                Donate/Support Me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Room Section */}
          <div
            className={`relative rounded-2xl p-4 border-2 transition-all ${
              isConnected
                ? "bg-green-50/80 border-green-200 shadow-xs"
                : "bg-red-50/80 border-red-200 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Wifi
                  className={`w-4 h-4 ${isConnected ? "text-green-500" : "text-red-500"}`}
                />
                <div className="flex-1 min-w-0">
                  {isEditingRoomName && isHost ? (
                    <Input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      onBlur={() => setIsEditingRoomName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setIsEditingRoomName(false);
                          if (
                            roomName.trim() &&
                            roomName !== room.name &&
                            onRenameRoom
                          ) {
                            onRenameRoom(roomName.trim());
                          }
                        }
                        if (e.key === "Escape") {
                          setRoomName(room.name);
                          setIsEditingRoomName(false);
                        }
                      }}
                      className="h-auto p-0 border-none shadow-none text-lg font-semibold bg-transparent focus-visible:ring-0"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`${isHost ? "cursor-pointer hover:bg-white/50 rounded px-1 -mx-1" : ""}`}
                      onClick={() => isHost && setIsEditingRoomName(true)}
                    >
                      <h2 className="font-semibold text-lg truncate">
                        {roomName}
                      </h2>
                    </div>
                  )}
                  <p
                    className={`text-sm ${isConnected ? "text-green-600" : "text-red-600"}`}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl bg-white/70 border-border/50"
                  onClick={copyRoomId}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleLeaveRoom}
                >
                  Leave
                </Button>
              </div>
            </div>

            {/* Video Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 h-auto rounded-full hover:bg-white/50"
                  disabled={isControlMode && !isHost}
                >
                  {isPaused ? (
                    <Play className="w-6 h-6 fill-current" />
                  ) : (
                    <Pause className="w-6 h-6 fill-current" />
                  )}
                </Button>
                <div className="flex-1 h-1.5 bg-white/60 rounded-full">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="text-lg font-mono font-semibold ml-3">
                {formatTime(videoState.currentTime)}
              </span>
            </div>
          </div>

          {/* Participants Section */}
          <div className="rounded-2xl border-2 border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">
                Participants ({room.users.length})
              </h3>
            </div>

            <div className="space-y-2">
              {room.users.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${participant.isConnected ? "bg-green-500" : "bg-gray-400"}`}
                    />
                    {participant.id === currentUser.id && isEditingUserName ? (
                      <Input
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        onBlur={() => {
                          setIsEditingUserName(false);
                          if (
                            userName.trim() &&
                            userName !== currentUser.name &&
                            onRenameUser
                          ) {
                            onRenameUser(userName.trim());
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setIsEditingUserName(false);
                            if (
                              userName.trim() &&
                              userName !== currentUser.name &&
                              onRenameUser
                            ) {
                              onRenameUser(userName.trim());
                            }
                          }
                          if (e.key === "Escape") {
                            setUserName(currentUser.name);
                            setIsEditingUserName(false);
                          }
                        }}
                        className="h-auto p-0 border-none shadow-none text-sm font-medium bg-transparent focus-visible:ring-0 w-32"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`font-medium ${participant.id === currentUser.id ? "cursor-pointer hover:text-blue-600" : ""}`}
                        onClick={() =>
                          participant.id === currentUser.id &&
                          setIsEditingUserName(true)
                        }
                      >
                        {participant.id === currentUser.id
                          ? userName
                          : participant.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.id === room.hostId && (
                      <>
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-yellow-800 border-yellow-200"
                        >
                          <Crown className="w-3 h-3 mr-1" />
                          Host
                        </Badge>
                        {participant.id !== currentUser.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleFollowMode}
                            className={`p-1 h-auto rounded-full transition-colors ${
                              isFollowingHost
                                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            title={
                              isFollowingHost
                                ? "Stop following host"
                                : "Follow host"
                            }
                          >
                            {isFollowingHost ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    {participant.id === currentUser.id && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        You
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Control Mode Toggle */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isControlMode ? (
                    <>
                      <Lock className="w-4 h-4 text-orange-600" />
                      <div>
                        <span className="text-sm font-medium">
                          Only host can control
                        </span>
                        {hostUser && (
                          <p className="text-xs text-muted-foreground">
                            Only {hostUser.name} can play/pause
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-green-600" />
                      <div>
                        <span className="text-sm font-medium">
                          Everyone can control
                        </span>
                        <p className="text-xs text-muted-foreground">
                          All participants can play/pause
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <Switch
                  checked={isControlMode}
                  onCheckedChange={onToggleControlMode}
                  disabled={!isHost}
                />
              </div>
            </div>

            {/* Following Status */}
            {isFollowingHost && hostUser && !isHost && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Eye className="w-4 h-4" />
                  <div>
                    <span className="font-medium">
                      Following {hostUser.name}
                    </span>
                    <p className="text-xs text-blue-600">
                      You&apos;ll automatically sync to their video position
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Follow notification */}
            {hasFollowNotification && !isHost && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <Eye className="w-4 h-4" />
                    <div>
                      <span className="font-medium">Host switched video</span>
                      <p className="text-xs text-yellow-600">
                        Click to follow {hostUser?.name}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
                    onClick={onFollowHost}
                  >
                    Follow
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
