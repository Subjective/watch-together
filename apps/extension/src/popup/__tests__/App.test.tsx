/**
 * Tests for App component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { App } from "../App";

// Mock chrome.runtime for testing
const mockSendMessage = vi.fn();
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

  it("should navigate to create room view", async () => {
    const user = userEvent.setup();
    render(<App />);

    const createButton = screen.getByRole("button", { name: "Create Room" });
    await user.click(createButton);

    expect(
      screen.getByRole("heading", { name: "Create Room" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Room Name")).toBeInTheDocument();
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

  it("should send GET_STATE message on mount", () => {
    render(<App />);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: "GET_STATE",
      timestamp: expect.any(Number),
    });
  });
});
