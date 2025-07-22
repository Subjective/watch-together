"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ExternalLink,
} from "lucide-react";
import type {
  RoomState,
  User,
  ConnectionStatus,
  FollowMode,
  ControlMode,
} from "@repo/types";

export function ExtensionMockup() {
  // Use static base timestamp to ensure deterministic SSR/hydration
  const baseTimestamp = 1735401600000; // January 2025

  // Mock room state
  const [room] = useState<RoomState>({
    id: "MOVIE-2024",
    name: "Movie Night",
    hostId: "1",
    users: [
      {
        id: "1",
        name: "Josh",
        isHost: true,
        isConnected: true,
        joinedAt: baseTimestamp - 1000 * 60 * 10,
      },
      {
        id: "2",
        name: "Kevin",
        isHost: false,
        isConnected: true,
        joinedAt: baseTimestamp - 1000 * 60 * 5,
      },
      {
        id: "3",
        name: "Weasel",
        isHost: false,
        isConnected: false,
        joinedAt: baseTimestamp - 1000 * 60 * 2,
      },
    ],
    controlMode: "HOST_ONLY" as ControlMode,
    followMode: "AUTO_FOLLOW" as FollowMode,
    videoState: {
      isPlaying: false,
      currentTime: 127.5,
      duration: 5400, // 90 minutes
      playbackRate: 1,
      url: "https://netflix.com/watch/12345",
      lastUpdated: baseTimestamp - 1000,
    },
    hostVideoState: {
      isPlaying: false,
      currentTime: 127.5,
      duration: 5400,
      playbackRate: 1,
      url: "https://netflix.com/watch/12345",
      lastUpdated: baseTimestamp - 1000,
    },
    hostCurrentUrl: "https://netflix.com/watch/12345",
    createdAt: baseTimestamp - 1000 * 60 * 15,
    lastActivity: baseTimestamp - 1000,
  });

  const [currentUser] = useState<User>({
    id: "2",
    name: "Kevin",
    isHost: false,
    isConnected: true,
    joinedAt: baseTimestamp - 1000 * 60 * 5,
  });

  const [connectionStatus] = useState<ConnectionStatus>("CONNECTED");
  const [followMode, setFollowMode] = useState<FollowMode>("AUTO_FOLLOW");
  const [hasFollowNotification] = useState(false);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [roomName, setRoomName] = useState(room.name);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [userName, setUserName] = useState(currentUser.name);
  const [showMenu, setShowMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(room.videoState.isPlaying);
  const [controlMode, setControlMode] = useState<ControlMode>(room.controlMode);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Calculate derived values
  const isHost = currentUser.id === room.hostId;
  const isControlMode = controlMode === "HOST_ONLY";
  const isControlDisabled = isControlMode && !isHost;
  const isConnected = connectionStatus === "CONNECTED";
  const hostUser = room.users.find((u) => u.id === room.hostId);
  const isFollowingHost = followMode === "AUTO_FOLLOW" && !isHost;
  const videoState = room.videoState;
  const currentTime =
    room.hostVideoState?.currentTime ?? videoState.currentTime;
  const totalDuration =
    videoState.duration > 0
      ? videoState.duration
      : (room.hostVideoState?.duration ?? 0);
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Mock handlers
  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  const copyRoomCode = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(room.id);
      showToastMessage("Room code copied to clipboard!");
    } catch {
      showToastMessage(`Room code: ${room.id}`);
    }
  }, [room.id, showToastMessage]);

  const toggleControlMode = useCallback(() => {
    if (isHost) {
      setControlMode((prev) =>
        prev === "HOST_ONLY" ? "FREE_FOR_ALL" : "HOST_ONLY",
      );
    }
  }, [isHost]);

  const toggleFollowMode = useCallback(() => {
    setFollowMode((prev) =>
      prev === "AUTO_FOLLOW" ? "MANUAL_FOLLOW" : "AUTO_FOLLOW",
    );
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isControlDisabled) {
      setIsPlaying((prev) => !prev);
    }
  }, [isControlDisabled]);

  return (
    <div className="relative w-full">
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 animate-in slide-in-from-top">
          <p className="text-sm text-gray-900">{toastMessage}</p>
        </div>
      )}

      {/* Browser mockup */}
      <div className="bg-gray-100 rounded-t-lg p-3">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
            netflix.com/watch/12345
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div
        className="bg-black rounded-b-lg relative overflow-hidden w-full min-h-[550px] sm:min-h-[650px]"
        style={{ aspectRatio: "16/12" }}
      >
        {/* Video placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            {isPlaying ? (
              <Pause className="h-16 w-16 mx-auto mb-4 opacity-50" />
            ) : (
              <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
            )}
            <p className="text-lg opacity-75">
              {isPlaying ? "Sample Movie Playing" : "Sample Movie Paused"}
            </p>
          </div>
        </div>

        {/* Extension popup - Modern realistic design */}
        <div className="absolute top-6 right-3 bottom-6 flex flex-col">
          <Card className="w-80 sm:w-96 max-w-[90vw] shadow-2xl border-0 bg-white flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between pt-1 pb-3 px-3 sm:pt-1 sm:pb-4 sm:px-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => showToastMessage("Back to home")}
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <h1 className="font-semibold text-lg sm:text-xl">
                  Watch Together
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 h-auto rounded-full"
                    onClick={() => setShowMenu(!showMenu)}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                      <div className="py-1">
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Settings
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                          <Flag className="w-4 h-4" />
                          Report Issue
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                          <Heart className="w-4 h-4" />
                          Donate/Support
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="pb-2 px-3 sm:pb-3 sm:px-4 space-y-3 sm:space-y-4">
                {/* Room Section */}
                <div
                  className={`relative rounded-2xl p-3 sm:p-4 border-2 transition-all ${
                    isConnected
                      ? "bg-green-50/80 border-green-200 shadow-xs"
                      : "bg-red-50/80 border-red-200 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Wifi
                        className={`w-4 h-4 ${
                          isConnected ? "text-green-500" : "text-red-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {isEditingRoomName && isHost ? (
                          <Input
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            onBlur={() => {
                              if (roomName.trim()) {
                                setIsEditingRoomName(false);
                                showToastMessage("Room name updated!");
                              } else {
                                setRoomName(room.name);
                                setIsEditingRoomName(false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (roomName.trim()) {
                                  setIsEditingRoomName(false);
                                  showToastMessage("Room name updated!");
                                } else {
                                  setRoomName(room.name);
                                  setIsEditingRoomName(false);
                                }
                              }
                              if (e.key === "Escape") {
                                setRoomName(room.name);
                                setIsEditingRoomName(false);
                              }
                            }}
                            className="h-auto p-0 border-none shadow-none !text-lg font-semibold bg-transparent focus-visible:ring-0"
                            autoFocus
                          />
                        ) : (
                          <div
                            className={`${
                              isHost
                                ? "cursor-pointer hover:bg-white/50 rounded px-1 -mx-1"
                                : ""
                            }`}
                            onClick={() => isHost && setIsEditingRoomName(true)}
                          >
                            <h2 className="font-semibold text-base sm:text-lg truncate">
                              {roomName}
                            </h2>
                          </div>
                        )}
                        <p
                          className={`text-sm ${
                            isConnected ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isConnected ? "Connected" : "Disconnected"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isHost ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl bg-white/70 border-border/50"
                          onClick={copyRoomCode}
                          title="Copy room code"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl bg-white/70 border-border/50"
                          onClick={() =>
                            showToastMessage("Opening host's video...")
                          }
                          title="Go to host's video"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => showToastMessage("Left room")}
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
                        disabled={isControlDisabled}
                        onClick={togglePlayPause}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 fill-current" />
                        ) : (
                          <Play className="w-6 h-6 fill-current" />
                        )}
                      </Button>
                      <div
                        className={`flex-1 h-1.5 bg-white/60 rounded-full transition-all ${
                          isControlDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        <div
                          className="h-full bg-foreground rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-lg font-mono font-semibold ml-3 transition-all ${
                        isControlDisabled ? "opacity-60" : ""
                      }`}
                    >
                      {formatTime(currentTime)}
                    </span>
                  </div>
                </div>

                {/* Participants Section */}
                <div className="rounded-2xl border-2 border-border bg-muted/30 p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <h3 className="font-semibold text-base sm:text-lg">
                      Participants ({room.users.length})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {room.users.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-2 sm:p-3 rounded-xl bg-background border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              participant.isConnected
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {participant.id === currentUser.id &&
                          isEditingUserName ? (
                            <Input
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              onBlur={() => {
                                if (userName.trim()) {
                                  setIsEditingUserName(false);
                                  showToastMessage("Name updated!");
                                } else {
                                  setUserName(currentUser.name);
                                  setIsEditingUserName(false);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (userName.trim()) {
                                    setIsEditingUserName(false);
                                    showToastMessage("Name updated!");
                                  } else {
                                    setUserName(currentUser.name);
                                    setIsEditingUserName(false);
                                  }
                                }
                                if (e.key === "Escape") {
                                  setUserName(currentUser.name);
                                  setIsEditingUserName(false);
                                }
                              }}
                              className="h-auto p-0 border-none shadow-none !text-base font-medium bg-transparent focus-visible:ring-0 w-32"
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`text-base font-medium ${
                                participant.id === currentUser.id
                                  ? "cursor-pointer hover:text-blue-600"
                                  : ""
                              }`}
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
                                  onClick={toggleFollowMode}
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
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isControlMode}
                          onChange={toggleControlMode}
                          disabled={!isHost}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
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
                            You&apos;ll automatically follow them to new videos
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
                            <span className="font-medium">
                              Host switched video
                            </span>
                            <p className="text-xs text-yellow-600">
                              Click to follow {hostUser?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
                          onClick={() => showToastMessage("Following host...")}
                        >
                          Follow
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sync indicator */}
        <div className="absolute bottom-2 left-4">
          <Badge className="bg-green-600 hover:bg-green-600">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            In sync • {room.users.filter((u) => u.isConnected).length} viewers
          </Badge>
        </div>
      </div>

      {/* Interactive hint */}
      <div className="text-center mt-4 sm:mt-6 px-4">
        <p className="text-xs sm:text-sm text-gray-600 max-w-2xl mx-auto">
          👆 Try interacting with the controls in the extension popup above.
        </p>
      </div>
    </div>
  );
}
