/**
 * Main App component for Watch Together popup
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ExtensionState,
  ExtensionMessage,
  CreateRoomRequest,
  JoinRoomRequest,
  LeaveRoomRequest,
  ToggleControlModeRequest,
  SetFollowModeRequest,
  FollowHostRequest,
  RenameUserRequest,
} from "@repo/types";
import { RoomCreate } from "./RoomCreate";
import { RoomJoin } from "./RoomJoin";
import { RoomManager } from "./RoomManager";
import { RecentRooms } from "./RecentRooms";
import { StorageManager } from "../background/storage";

type View = "home" | "create" | "join" | "room";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>("home");
  const [extensionState, setExtensionState] = useState<ExtensionState>({
    isConnected: false,
    currentRoom: null,
    connectionStatus: "DISCONNECTED",
    currentUser: null,
    followMode: "AUTO_FOLLOW",
    hasFollowNotification: false,
    followNotificationUrl: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [justCreatedRoom, setJustCreatedRoom] = useState(false);

  // Service Worker communication
  const sendMessage = useCallback(async (message: ExtensionMessage) => {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      console.error("Failed to send message to Service Worker:", error);
      throw error;
    }
  }, []);

  // Load initial state from chrome storage
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const result = await chrome.storage.local.get("extensionState");
        const storedState = result.extensionState as ExtensionState | undefined;
        if (storedState) {
          setExtensionState(storedState);
          if (storedState.currentRoom) {
            setCurrentView("room");
          }
        }
      } catch (error) {
        console.error("Failed to load initial state:", error);
      }
    };

    loadInitialState();
  }, []);

  // Keep extension state in sync with storage updates
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && changes.extensionState) {
        const newState = changes.extensionState.newValue as ExtensionState;
        setExtensionState(newState);
        if (newState.currentRoom) {
          setCurrentView("room");
        } else {
          setCurrentView("home");
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Listen for state updates from Service Worker
  useEffect(() => {
    const handleMessage = (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void,
    ) => {
      if (message.type === "STATE_UPDATE") {
        setExtensionState(message.state);
        // Update view based on room state
        if (message.state.currentRoom && currentView !== "room") {
          setCurrentView("room");
        } else if (!message.state.currentRoom && currentView === "room") {
          setCurrentView("home");
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [currentView]);

  // Auto-copy room ID when room is created
  useEffect(() => {
    if (justCreatedRoom && extensionState.currentRoom) {
      const copyRoomId = async () => {
        try {
          await navigator.clipboard.writeText(extensionState.currentRoom!.id);
          setRoomIdCopied(true);
          setTimeout(() => setRoomIdCopied(false), 3000);
        } catch (error) {
          console.error("Failed to copy room ID:", error);
        }
      };

      copyRoomId();
      setJustCreatedRoom(false);
    }
  }, [justCreatedRoom, extensionState.currentRoom]);

  // Navigation handlers
  const handleCreateRoom = useCallback(
    async (roomName: string, userName: string) => {
      setIsLoading(true);
      try {
        const message: CreateRoomRequest = {
          type: "CREATE_ROOM",
          roomName,
          userName,
          timestamp: Date.now(),
        };
        await sendMessage(message);
        // View will be updated by state update message
      } catch (error) {
        console.error("Failed to create room:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage],
  );

  const handleJoinRoom = useCallback(
    async (roomId: string, userName: string) => {
      setIsLoading(true);
      try {
        const message: JoinRoomRequest = {
          type: "JOIN_ROOM",
          roomId,
          userName,
          timestamp: Date.now(),
        };
        await sendMessage(message);
        // View will be updated by state update message
      } catch (error) {
        console.error("Failed to join room:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage],
  );

  const handleLeaveRoom = useCallback(async () => {
    try {
      const message: LeaveRoomRequest = {
        type: "LEAVE_ROOM",
        timestamp: Date.now(),
      };
      await sendMessage(message);
      setCurrentView("home");
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  }, [sendMessage]);

  const handleToggleControlMode = useCallback(async () => {
    try {
      const message: ToggleControlModeRequest = {
        type: "TOGGLE_CONTROL_MODE",
        timestamp: Date.now(),
      };
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to toggle control mode:", error);
    }
  }, [sendMessage]);

  const handleToggleFollowMode = useCallback(async () => {
    try {
      const newMode =
        extensionState.followMode === "AUTO_FOLLOW"
          ? "MANUAL_FOLLOW"
          : "AUTO_FOLLOW";
      const message: SetFollowModeRequest = {
        type: "SET_FOLLOW_MODE",
        mode: newMode,
        timestamp: Date.now(),
      };
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to toggle follow mode:", error);
    }
  }, [sendMessage, extensionState.followMode]);

  const handleFollowHost = useCallback(async () => {
    try {
      const message: FollowHostRequest = {
        type: "FOLLOW_HOST",
        timestamp: Date.now(),
      };
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to follow host:", error);
    }
  }, [sendMessage]);

  const handleRenameUser = useCallback(
    async (newUserName: string) => {
      try {
        const message: RenameUserRequest = {
          type: "RENAME_USER",
          newUserName,
          timestamp: Date.now(),
        };
        await sendMessage(message);
      } catch (error) {
        console.error("Failed to rename user:", error);
      }
    },
    [sendMessage],
  );

  const handleQuickCreateRoom = useCallback(async () => {
    setIsLoading(true);
    setJustCreatedRoom(true);
    try {
      const preferences = await StorageManager.getUserPreferences();
      const roomName = preferences.defaultRoomName || "My Room";
      const userName = preferences.defaultUserName || "Guest";

      const message: CreateRoomRequest = {
        type: "CREATE_ROOM",
        roomName,
        userName,
        timestamp: Date.now(),
      };
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to create room:", error);
      setJustCreatedRoom(false);
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage]);

  const handleCopyRoomId = useCallback(async () => {
    if (!extensionState.currentRoom) return;

    try {
      await navigator.clipboard.writeText(extensionState.currentRoom.id);
      setRoomIdCopied(true);
      setTimeout(() => setRoomIdCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy room ID:", error);
    }
  }, [extensionState.currentRoom]);

  // Render appropriate view
  const renderView = useMemo(() => {
    switch (currentView) {
      case "create":
        return (
          <RoomCreate
            onCreateRoom={handleCreateRoom}
            onBack={() => setCurrentView("home")}
            isLoading={isLoading}
          />
        );
      case "join":
        return (
          <RoomJoin
            onJoinRoom={handleJoinRoom}
            onBack={() => setCurrentView("home")}
            isLoading={isLoading}
          />
        );
      case "room":
        if (!extensionState.currentRoom || !extensionState.currentUser) {
          setCurrentView("home");
          return null;
        }
        return (
          <div className="h-full flex flex-col">
            {roomIdCopied && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 text-sm font-medium">
                ✅ Room ID copied to clipboard!
              </div>
            )}
            <RoomManager
              room={extensionState.currentRoom}
              currentUser={extensionState.currentUser}
              connectionStatus={extensionState.connectionStatus}
              followMode={extensionState.followMode}
              hasFollowNotification={extensionState.hasFollowNotification}
              onLeaveRoom={handleLeaveRoom}
              onToggleControlMode={handleToggleControlMode}
              onToggleFollowMode={handleToggleFollowMode}
              onFollowHost={handleFollowHost}
              onRenameUser={handleRenameUser}
            />
          </div>
        );
      default:
        return (
          <div className="p-4 h-full flex flex-col">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Watch Together
              </h1>
              <p className="text-gray-600 text-sm">
                Synchronized video watching with friends
              </p>
            </div>

            <div className="flex-1 flex flex-col">
              <RecentRooms onJoinRoom={handleJoinRoom} />

              <div className="space-y-4">
                <button
                  onClick={handleQuickCreateRoom}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Creating Room..." : "Create Room"}
                </button>

                <button
                  onClick={() => setCurrentView("join")}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                >
                  Join Room
                </button>
              </div>

              <div className="mt-6 text-center">
                {extensionState.currentRoom ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Room Created Successfully!
                    </p>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xs text-blue-700 font-mono">
                        {extensionState.currentRoom.id}
                      </span>
                      <button
                        onClick={handleCopyRoomId}
                        className="text-blue-600 hover:text-blue-800 text-xs bg-blue-100 px-2 py-1 rounded"
                      >
                        {roomIdCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Create or join a room to watch videos together
                  </p>
                )}
              </div>
            </div>
          </div>
        );
    }
  }, [
    currentView,
    extensionState,
    isLoading,
    handleCreateRoom,
    handleJoinRoom,
    handleLeaveRoom,
    handleToggleControlMode,
    handleToggleFollowMode,
    handleFollowHost,
    handleRenameUser,
    handleQuickCreateRoom,
    handleCopyRoomId,
    roomIdCopied,
  ]);

  return <div className="w-full h-full bg-gray-100">{renderView}</div>;
};
