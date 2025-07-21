"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Play, Pause, Settings, UserCheck } from "lucide-react";
import type { User, ConnectionStatus } from "@repo/types";

export function ExtensionMockup() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roomCode] = useState("MOVIE-2024");
  const [connectionStatus] = useState<ConnectionStatus>("CONNECTED");
  // Use static base timestamp to ensure deterministic SSR/hydration
  const baseTimestamp = 1735401600000; // January 2025
  const [participants] = useState<User[]>([
    {
      id: "1",
      name: "Alex",
      isHost: true,
      isConnected: true,
      joinedAt: baseTimestamp - 1000 * 60 * 10,
    },
    {
      id: "2",
      name: "Sarah",
      isHost: false,
      isConnected: true,
      joinedAt: baseTimestamp - 1000 * 60 * 5,
    },
    {
      id: "3",
      name: "Mike",
      isHost: false,
      isConnected: false,
      joinedAt: baseTimestamp - 1000 * 60 * 2,
    },
  ]);

  return (
    <div className="relative">
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
        className="bg-black rounded-b-lg relative overflow-hidden"
        style={{ aspectRatio: "16/9" }}
      >
        {/* Video placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <Play
              className="h-16 w-16 mx-auto mb-4 opacity-50"
              aria-hidden="true"
            />
            <p className="text-lg opacity-75">Sample Movie Playing</p>
          </div>
        </div>

        {/* Extension popup */}
        <div className="absolute top-4 right-4">
          <Card className="w-80 shadow-2xl border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded flex items-center justify-center">
                    <Play className="h-3 w-3 text-white" aria-hidden="true" />
                  </div>
                  <span>Watch Together</span>
                </CardTitle>
                <Badge
                  variant="secondary"
                  className={
                    connectionStatus === "CONNECTED"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  <div
                    className={`w-2 h-2 rounded-full mr-1 ${connectionStatus === "CONNECTED" ? "bg-green-500" : "bg-red-500"}`}
                  ></div>
                  {connectionStatus === "CONNECTED"
                    ? "Connected"
                    : "Disconnected"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Room info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Room Code</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(roomCode)}
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3 mr-1" aria-hidden="true" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-100 rounded px-3 py-2 font-mono text-sm">
                  {roomCode}
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center">
                    👥 Participants ({participants.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {participant.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {participant.name}
                          {participant.isHost && (
                            <span className="ml-1 text-xs text-purple-600">
                              (Host)
                            </span>
                          )}
                        </span>
                      </div>
                      <Badge
                        variant={
                          participant.isConnected ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {participant.isConnected ? "connected" : "offline"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Button
                    variant={isPlaying ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 mr-1" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" aria-hidden="true" />
                    )}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button variant="outline" size="sm" title="Follow host video">
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant={showSettings ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                {/* Control Mode Toggle */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Control Mode:</span>
                  <Badge variant="secondary" className="text-xs">
                    Host Only
                  </Badge>
                </div>
              </div>

              {/* Settings section */}
              {showSettings && (
                <div className="border-t pt-3 space-y-3">
                  <div className="text-sm font-medium">Room Settings</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Auto-follow host
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs bg-green-50 text-green-700"
                      >
                        ON
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Notifications
                      </span>
                      <Badge variant="outline" className="text-xs">
                        OFF
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Enhanced URLs
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs bg-blue-50 text-blue-700"
                      >
                        ON
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  size="sm"
                >
                  📤 Share Room
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  size="sm"
                >
                  🎯 Go to Host Video
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync indicator */}
        <div className="absolute bottom-4 left-4">
          <Badge className="bg-green-600 hover:bg-green-600">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            In sync • 3 viewers
          </Badge>
        </div>
      </div>

      {/* Interactive hint */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-600">
          👆 Try clicking the play/pause button or settings toggle in the
          extension popup above
        </p>
      </div>
    </div>
  );
}
