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
  GetStateRequest,
} from "@repo/types";
import { RoomCreate } from "./RoomCreate";
import { RoomJoin } from "./RoomJoin";
import { RoomManager } from "./RoomManager";

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

  // Load initial state from Service Worker
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const message: GetStateRequest = {
          type: "GET_STATE",
          timestamp: Date.now(),
        };
        const state = await sendMessage(message);
        if (state) {
          setExtensionState(state);
          // Set view based on current room state
          if (state.currentRoom) {
            setCurrentView("room");
          }
        }
      } catch (error) {
        console.error("Failed to load initial state:", error);
      }
    };

    loadInitialState();
  }, [sendMessage]);

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
          />
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

            <div className="flex-1 flex flex-col justify-center space-y-4">
              <button
                onClick={() => setCurrentView("create")}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                Create Room
              </button>

              <button
                onClick={() => setCurrentView("join")}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
              >
                Join Room
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Create or join a room to watch videos together
              </p>
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
  ]);

  return <div className="w-full h-full bg-gray-100">{renderView}</div>;
};
