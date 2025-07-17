/**
 * Main App component for Watch Together popup
 */
import React, { useState, useEffect, useCallback } from "react";
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
  RenameRoomRequest,
} from "@repo/types";
import { HomePage } from "./HomePage";
import { RoomPage } from "./RoomPage";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { StorageManager } from "../background/storage";
import type { RoomHistoryEntry } from "../background/storage";

export const App: React.FC = () => {
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
  const [recentRooms, setRecentRooms] = useState<RoomHistoryEntry[]>([]);
  const [pendingRoomCreation, setPendingRoomCreation] = useState(false);

  // Service Worker communication
  const sendMessage = useCallback(async (message: ExtensionMessage) => {
    try {
      const response = await chrome.runtime.sendMessage(message);

      // Check if the response indicates an error
      if (response && response.success === false) {
        throw new Error(response.error || "Operation failed");
      }

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
        }

        // Load recent rooms
        const rooms = await StorageManager.getRoomHistory();
        setRecentRooms(rooms);
      } catch (error) {
        console.error("Failed to load initial state:", error);
      }
    };

    loadInitialState();
  }, []);

  // Keep extension state in sync with storage updates
  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local") {
        if (changes.extensionState) {
          const newState = changes.extensionState.newValue as ExtensionState;
          setExtensionState(newState);
        }
        if (changes.roomHistory) {
          const rooms = await StorageManager.getRoomHistory();
          setRecentRooms(rooms);
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
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Auto-copy room ID when room is created
  const handleRoomCreated = useCallback(async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast({
        title: "Room created!",
        description: "Room code copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy room ID:", error);
      toast({
        title: "Room created!",
        description: `Room code: ${roomId}`,
      });
    }
  }, []);

  // Auto-copy room ID when room is created
  useEffect(() => {
    if (pendingRoomCreation && extensionState.currentRoom) {
      handleRoomCreated(extensionState.currentRoom.id);
      setPendingRoomCreation(false);
    }
  }, [extensionState.currentRoom, pendingRoomCreation, handleRoomCreated]);

  // Navigation handlers
  const handleCreateRoom = useCallback(
    async (roomName: string, userName: string) => {
      setIsLoading(true);
      setPendingRoomCreation(true);
      try {
        const message: CreateRoomRequest = {
          type: "CREATE_ROOM",
          roomName,
          userName,
          timestamp: Date.now(),
        };
        await sendMessage(message);
      } catch (error) {
        console.error("Failed to create room:", error);
        setPendingRoomCreation(false);
        toast({
          title: "Failed to create room",
          description: "Please try again",
          variant: "destructive",
        });
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
      } catch (error) {
        console.error("Failed to join room:", error);
        toast({
          title: "Failed to join room",
          description: "Please check the room code and try again",
          variant: "destructive",
        });
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
    } catch (error) {
      console.error("Failed to leave room:", error);
      toast({
        title: "Failed to leave room",
        description: "Please try again",
        variant: "destructive",
      });
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
    async (newUserName: string): Promise<void> => {
      const message: RenameUserRequest = {
        type: "RENAME_USER",
        newUserName,
        timestamp: Date.now(),
      };
      await sendMessage(message);
    },
    [sendMessage],
  );

  const handleRenameRoom = useCallback(
    async (newRoomName: string): Promise<void> => {
      const message: RenameRoomRequest = {
        type: "RENAME_ROOM",
        newRoomName,
        timestamp: Date.now(),
      };
      await sendMessage(message);
    },
    [sendMessage],
  );

  const handleNavigateToHome = useCallback(async () => {
    await handleLeaveRoom();
  }, [handleLeaveRoom]);

  return (
    <>
      {!extensionState.currentRoom || !extensionState.currentUser ? (
        <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isLoading={isLoading}
          recentRooms={recentRooms}
        />
      ) : (
        <RoomPage
          room={extensionState.currentRoom}
          currentUser={extensionState.currentUser}
          connectionStatus={extensionState.connectionStatus}
          followMode={extensionState.followMode}
          hasFollowNotification={extensionState.hasFollowNotification}
          onNavigateToHome={handleNavigateToHome}
          onLeaveRoom={handleLeaveRoom}
          onToggleControlMode={handleToggleControlMode}
          onToggleFollowMode={handleToggleFollowMode}
          onFollowHost={handleFollowHost}
          onRenameUser={handleRenameUser}
          onRenameRoom={handleRenameRoom}
        />
      )}
      <Toaster />
    </>
  );
};
