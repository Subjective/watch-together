/**
 * Tests for App component
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { App } from "../App";
import { StorageManager } from "../../background/storage";
import {
  setupTestEnvironment,
  getChromeForTest,
  createMockExtensionState,
  createMockUser,
  createMockRoom,
  createMockUserPreferences,
} from "../../test-utils";

// Setup test environment with proper Chrome and Navigator mocks
setupTestEnvironment();

// Mock StorageManager
vi.mock("../../background/storage", () => ({
  StorageManager: {
    getRoomHistory: vi.fn(),
    getUserPreferences: vi.fn(),
  },
}));

describe("App", () => {
  beforeEach(() => {
    const chrome = getChromeForTest();

    // Setup Chrome API mocks
    chrome.runtime.sendMessage.mockResolvedValue({});
    chrome.storage.local.get.mockResolvedValue({
      extensionState: createMockExtensionState(),
    });

    // Mock StorageManager methods
    vi.mocked(StorageManager.getRoomHistory).mockResolvedValue([]);
    vi.mocked(StorageManager.getUserPreferences).mockResolvedValue(
      createMockUserPreferences({ defaultUserName: "Guest" }),
    );
  });

  it("should render home page by default", async () => {
    render(<App />);

    expect(screen.getByText("Watch Together")).toBeInTheDocument();
    expect(
      screen.getByText("Synchronized video watching with friends"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter room code to join..."),
    ).toBeInTheDocument();
  });

  it("should render room page when user is in a room", async () => {
    const chrome = getChromeForTest();
    const hostUser = createMockUser({
      id: "user-1",
      name: "Host User",
      isHost: true,
    });
    const guestUser = createMockUser({
      id: "user-2",
      name: "Guest User",
      isHost: false,
    });
    const room = createMockRoom({
      id: "test-room-id",
      name: "Test Room",
      hostId: "user-1",
      users: [hostUser, guestUser],
    });

    chrome.storage.local.get.mockResolvedValue({
      extensionState: createMockExtensionState({
        isConnected: true,
        currentRoom: room,
        connectionStatus: "CONNECTED",
        currentUser: hostUser,
      }),
    });

    render(<App />);

    // Wait for the component to render the room page
    await screen.findByText("Test Room");
    expect(screen.getByText("Test Room")).toBeInTheDocument();
    expect(screen.getByText("Participants (2)")).toBeInTheDocument();
    expect(screen.getByText("Host User")).toBeInTheDocument();
    expect(screen.getByText("Guest User")).toBeInTheDocument();
  });

  it("should handle create room action", async () => {
    const user = userEvent.setup();
    const chrome = getChromeForTest();

    render(<App />);

    const createButton = screen.getByRole("button", { name: "Create Room" });
    await user.click(createButton);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "CREATE_ROOM",
      roomName: expect.stringMatching(
        /Movie Night|Watch Party|Cozy Cinema|Fun Hangout|Epic Session|Chill Time/,
      ),
      userName: "Guest",
      timestamp: expect.any(Number),
    });
  });

  it("should handle join room action", async () => {
    const user = userEvent.setup();
    const chrome = getChromeForTest();

    render(<App />);

    const roomInput = screen.getByPlaceholderText("Enter room code to join...");
    const joinButton = screen.getByRole("button", { name: "Join" });

    await user.type(roomInput, "test-room-id");
    await user.click(joinButton);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "JOIN_ROOM",
      roomId: "test-room-id",
      userName: "Guest",
      timestamp: expect.any(Number),
    });
  });

  it("should load state from chrome storage on mount", async () => {
    const chrome = getChromeForTest();

    render(<App />);

    expect(chrome.storage.local.get).toHaveBeenCalledWith("extensionState");
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it("should handle storage changes", async () => {
    const chrome = getChromeForTest();

    render(<App />);

    // Verify we start on the home page
    expect(screen.getByText("Watch Together")).toBeInTheDocument();
    expect(
      screen.getByText("Synchronized video watching with friends"),
    ).toBeInTheDocument();

    // Get the storage listener that was registered
    const storageListener =
      chrome.storage.onChanged.addListener.mock.calls[0][0];

    // Create mock data for a simple storage change
    const changes = {
      extensionState: {
        newValue: createMockExtensionState({
          isConnected: true,
          connectionStatus: "CONNECTED",
        }),
        oldValue: createMockExtensionState(),
      },
    };

    // Simulate storage change
    await act(async () => {
      await storageListener(changes, "local");
    });

    // Since the storage change doesn't include currentRoom or currentUser,
    // the component should still show the home page but with updated state
    expect(screen.getByText("Watch Together")).toBeInTheDocument();
    expect(
      screen.getByText("Synchronized video watching with friends"),
    ).toBeInTheDocument();
  });
});
