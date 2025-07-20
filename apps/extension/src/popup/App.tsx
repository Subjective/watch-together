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
import { SettingsPage } from "./SettingsPage";
import { Toaster } from "@/components/ui/toaster";
import { useConditionalToast } from "@/hooks/use-conditional-toast";
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
  const [showSettings, setShowSettings] = useState(false);
  const conditionalToast = useConditionalToast();

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
  const handleRoomCreated = useCallback(
    async (roomId: string) => {
      try {
        // Load user preferences to check enhanced URL setting
        const preferences = await StorageManager.getUserPreferences();

        // Check if current tab has an adapter for enhanced link
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const currentTabId = tabs[0]?.id;
        let hasAdapter = false;
        if (currentTabId) {
          try {
            const res = await chrome.tabs.sendMessage(currentTabId, {
              type: "CHECK_ADAPTER_STATUS",
              timestamp: Date.now(),
            });
            hasAdapter = !!res?.hasAdapter;
          } catch {
            // No adapter available on current tab, hasAdapter remains false
            hasAdapter = false;
          }
        }

        let textToCopy = roomId;
        let description = "Room code copied to clipboard";

        if (preferences.preferEnhancedUrl && hasAdapter) {
          // Get current tab URL and create enhanced share link
          try {
            const tabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            const currentTabUrl = tabs[0]?.url;

            if (currentTabUrl) {
              const url = new URL(currentTabUrl);
              url.searchParams.set("wt_room", roomId);
              textToCopy = url.toString();
              description = "Share link copied to clipboard";
            }
          } catch {
            // Fallback to room code if URL creation fails
          }
        }

        await navigator.clipboard.writeText(textToCopy);
        await conditionalToast({
          title: "Room created!",
          description: description,
        });
      } catch (error) {
        console.error("Failed to copy room link:", error);
        await conditionalToast({
          title: "Room created!",
          description: `Room code: ${roomId}`,
        });
      }
    },
    [conditionalToast],
  );

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
        await conditionalToast({
          title: "Failed to create room",
          description: "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, conditionalToast],
  );

  const handleJoinRoom = useCallback(
    async (
      roomId: string,
      userName: string,
      allowRecreation: boolean = false,
    ) => {
      setIsLoading(true);
      try {
        const message: JoinRoomRequest = {
          type: "JOIN_ROOM",
          roomId,
          userName,
          allowRecreation,
          timestamp: Date.now(),
        };
        await sendMessage(message);
      } catch (error) {
        console.error("Failed to join room:", error);
        await conditionalToast({
          title: "Failed to join room",
          description: "Please check the room code and try again",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, conditionalToast],
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
      await conditionalToast({
        title: "Failed to leave room",
        description: "Please try again",
        variant: "destructive",
      });
    }
  }, [sendMessage, conditionalToast]);

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
    if (showSettings) {
      setShowSettings(false);
    } else {
      await handleLeaveRoom();
    }
  }, [handleLeaveRoom, showSettings]);

  const handleNavigateToSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  return (
    <>
      {showSettings ? (
        <SettingsPage onNavigateToHome={handleNavigateToHome} />
      ) : !extensionState.currentRoom || !extensionState.currentUser ? (
        <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onNavigateToSettings={handleNavigateToSettings}
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
          onNavigateToSettings={handleNavigateToSettings}
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
