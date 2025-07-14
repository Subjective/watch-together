/**
 * Tests for App component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { App } from "../App";
import { StorageManager } from "../../background/storage";

// Mock chrome.runtime for testing
const mockSendMessage = vi.fn();

// Mock StorageManager
vi.mock("../../background/storage", () => ({
  StorageManager: {
    getUserPreferences: vi.fn(),
    getRoomHistory: vi.fn(),
  },
}));
global.chrome = {
  ...global.chrome,
  runtime: {
    ...global.chrome.runtime,
    sendMessage: mockSendMessage,
  },
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      isConnected: false,
      currentRoom: null,
      connectionStatus: "DISCONNECTED",
      currentUser: null,
      followMode: "AUTO_FOLLOW",
      hasFollowNotification: false,
      followNotificationUrl: null,
    });

    // Mock StorageManager.getUserPreferences to return default values
    vi.mocked(StorageManager.getUserPreferences).mockResolvedValue({
      followMode: "AUTO_FOLLOW",
      autoJoinRooms: false,
      notificationsEnabled: true,
      defaultUserName: "",
      defaultRoomName: "My Room",
      backgroundSyncEnabled: true,
    });

    // Mock StorageManager.getRoomHistory to return empty array
    vi.mocked(StorageManager.getRoomHistory).mockResolvedValue([]);
  });

  it("should render home screen by default", async () => {
    render(<App />);

    expect(screen.getByText("Watch Together")).toBeInTheDocument();
    expect(
      screen.getByText("Synchronized video watching with friends"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Room" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join Room" }),
    ).toBeInTheDocument();
  });

  it("should create room directly when Create Room button is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    const createButton = screen.getByRole("button", { name: "Create Room" });
    await user.click(createButton);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: "CREATE_ROOM",
      roomName: "My Room",
      userName: "Guest",
      timestamp: expect.any(Number),
    });
  });

  it("should navigate to join room view", async () => {
    const user = userEvent.setup();
    render(<App />);

    const joinButton = screen.getByRole("button", { name: "Join Room" });
    await user.click(joinButton);

    expect(
      screen.getByRole("heading", { name: "Join Room" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Room ID")).toBeInTheDocument();
  });

  it("should load state from chrome storage on mount", async () => {
    render(<App />);

    expect(chrome.storage.local.get).toHaveBeenCalledWith("extensionState");
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
  });
});
