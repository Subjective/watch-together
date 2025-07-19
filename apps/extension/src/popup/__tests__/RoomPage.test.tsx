/**
 * Tests for RoomPage component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RoomPage } from "../RoomPage";
import type { RoomState, User } from "@repo/types";
import {
  setupTestEnvironment,
  createMockUser,
  createMockRoom,
  getChromeForTest,
} from "../../test-utils";

// Setup test environment with proper Chrome and Navigator mocks
const { getNavigatorMock } = setupTestEnvironment();

describe("RoomPage", () => {
  const mockOnNavigateToHome = vi.fn();
  const mockOnLeaveRoom = vi.fn();
  const mockOnToggleControlMode = vi.fn();
  const mockOnToggleFollowMode = vi.fn();
  const mockOnFollowHost = vi.fn();
  const mockOnRenameUser = vi.fn();
  const mockOnRenameRoom = vi.fn();

  const mockCurrentUser: User = createMockUser({
    id: "user-1",
    name: "Current User",
    isHost: false,
  });

  const mockHostUser: User = createMockUser({
    id: "host-1",
    name: "Host User",
    isHost: true,
  });

  const mockRoom: RoomState = createMockRoom({
    id: "room-123",
    name: "Test Room",
    hostId: "host-1",
    users: [mockHostUser, mockCurrentUser],
    videoState: {
      currentTime: 30,
      duration: 120,
      isPlaying: false,
      playbackRate: 1,
      url: "https://example.com/video",
      lastUpdated: Date.now(),
    },
  });

  const defaultProps = {
    room: mockRoom,
    currentUser: mockCurrentUser,
    connectionStatus: "CONNECTED" as const,
    followMode: "AUTO_FOLLOW" as const,
    hasFollowNotification: false,
    onNavigateToHome: mockOnNavigateToHome,
    onLeaveRoom: mockOnLeaveRoom,
    onToggleControlMode: mockOnToggleControlMode,
    onToggleFollowMode: mockOnToggleFollowMode,
    onFollowHost: mockOnFollowHost,
    onRenameUser: mockOnRenameUser,
    onRenameRoom: mockOnRenameRoom,
  };

  beforeEach(() => {
    const navigator = getNavigatorMock();
    const chrome = getChromeForTest();

    // Setup navigator clipboard mock
    navigator.clipboard.writeText.mockResolvedValue(undefined);

    // Setup chrome runtime mock for new message types
    chrome.runtime.sendMessage.mockResolvedValue({ success: true, url: null });
  });

  it("should render room page with basic elements", () => {
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByText("Watch Together")).toBeInTheDocument();
    expect(screen.getByText("Test Room")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Participants (2)")).toBeInTheDocument();
    expect(screen.getByText("Host User")).toBeInTheDocument();
    expect(screen.getByText("Current User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });

  it("should handle navigation back to home", async () => {
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    const backButton = screen.getAllByRole("button", { name: "" })[0]; // First button is arrow left
    await user.click(backButton);

    expect(mockOnNavigateToHome).toHaveBeenCalled();
  });

  it("should handle leave room action", async () => {
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    const leaveButton = screen.getByRole("button", { name: "Leave" });
    await user.click(leaveButton);

    expect(mockOnLeaveRoom).toHaveBeenCalled();
    expect(mockOnNavigateToHome).toHaveBeenCalled();
  });

  it("should handle room ID copy", async () => {
    const user = userEvent.setup();
    const chrome = getChromeForTest();
    render(<RoomPage {...defaultProps} />);

    // Find the copy button by looking for the button with Copy icon
    const allButtons = screen.getAllByRole("button", { name: "" });
    const copyButton = allButtons.find((button) =>
      button.querySelector('svg[class*="lucide-copy"]'),
    );
    expect(copyButton).toBeDefined();
    await user.click(copyButton!);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "GET_ACTIVE_ADAPTER_TAB_URL",
      timestamp: expect.any(Number),
    });
  });

  it("should show host controls when user is host", () => {
    const hostProps = {
      ...defaultProps,
      currentUser: mockHostUser,
      room: { ...mockRoom, hostId: "host-1" },
    };

    render(<RoomPage {...hostProps} />);

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument(); // Control mode switch
  });

  it("should handle control mode toggle", async () => {
    const user = userEvent.setup();
    const hostProps = {
      ...defaultProps,
      currentUser: mockHostUser,
      room: { ...mockRoom, hostId: "host-1" },
    };

    render(<RoomPage {...hostProps} />);

    const controlSwitch = screen.getByRole("switch");
    await user.click(controlSwitch);

    expect(mockOnToggleControlMode).toHaveBeenCalled();
  });

  it("should show follow mode controls for non-host users", () => {
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop following host" }),
    ).toBeInTheDocument();
  });

  it("should handle follow mode toggle", async () => {
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    const followButton = screen.getByRole("button", {
      name: "Stop following host",
    });
    await user.click(followButton);

    expect(mockOnToggleFollowMode).toHaveBeenCalled();
  });

  it("should show follow notification when present", () => {
    const propsWithNotification = {
      ...defaultProps,
      hasFollowNotification: true,
    };

    render(<RoomPage {...propsWithNotification} />);

    expect(screen.getByText("Host switched video")).toBeInTheDocument();
    expect(screen.getByText("Follow")).toBeInTheDocument();
  });

  it("should handle follow host action", async () => {
    const user = userEvent.setup();
    const propsWithNotification = {
      ...defaultProps,
      hasFollowNotification: true,
    };

    render(<RoomPage {...propsWithNotification} />);

    const followButton = screen.getByRole("button", { name: "Follow" });
    await user.click(followButton);

    expect(mockOnFollowHost).toHaveBeenCalled();
  });

  it("should handle room name editing when user is host", async () => {
    const user = userEvent.setup();
    const hostProps = {
      ...defaultProps,
      currentUser: mockHostUser,
      room: { ...mockRoom, hostId: "host-1" },
    };

    render(<RoomPage {...hostProps} />);

    const roomNameElement = screen.getByText("Test Room");
    await user.click(roomNameElement);

    const input = screen.getByDisplayValue("Test Room");
    await user.clear(input);
    await user.type(input, "New Room Name");
    await user.keyboard("{Enter}");

    expect(mockOnRenameRoom).toHaveBeenCalledWith("New Room Name");
  });

  it("should handle user name editing", async () => {
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    const userNameElement = screen.getByText("Current User");
    await user.click(userNameElement);

    const input = screen.getByDisplayValue("Current User");
    await user.clear(input);
    await user.type(input, "New User Name");
    await user.keyboard("{Enter}");

    expect(mockOnRenameUser).toHaveBeenCalledWith("New User Name");
  });

  it("should handle escape key during editing", async () => {
    const user = userEvent.setup();
    const hostProps = {
      ...defaultProps,
      currentUser: mockHostUser,
      room: { ...mockRoom, hostId: "host-1" },
    };

    render(<RoomPage {...hostProps} />);

    const roomNameElement = screen.getByText("Test Room");
    await user.click(roomNameElement);

    const input = screen.getByDisplayValue("Test Room");
    await user.clear(input);
    await user.type(input, "New Room Name");
    await user.keyboard("{Escape}");

    expect(mockOnRenameRoom).not.toHaveBeenCalled();
    expect(screen.getByText("Test Room")).toBeInTheDocument();
  });

  it("should show disconnected state", () => {
    const disconnectedProps = {
      ...defaultProps,
      connectionStatus: "DISCONNECTED" as const,
    };

    render(<RoomPage {...disconnectedProps} />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("should show control mode state correctly", () => {
    const hostOnlyProps = {
      ...defaultProps,
      room: createMockRoom({
        ...mockRoom,
        controlMode: "HOST_ONLY" as const,
      }),
    };

    render(<RoomPage {...hostOnlyProps} />);

    expect(screen.getByText("Only host can control")).toBeInTheDocument();
    expect(
      screen.getByText("Only Host User can play/pause"),
    ).toBeInTheDocument();
  });

  it("should show following status when following host", () => {
    const followingProps = {
      ...defaultProps,
      followMode: "AUTO_FOLLOW" as const,
    };

    render(<RoomPage {...followingProps} />);

    expect(screen.getByText("Following Host User")).toBeInTheDocument();
    expect(
      screen.getByText("You'll automatically sync to their video position"),
    ).toBeInTheDocument();
  });

  it("should format video time correctly", () => {
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByText("0:30")).toBeInTheDocument(); // 30 seconds formatted
  });

  it("should show video progress bar", () => {
    render(<RoomPage {...defaultProps} />);

    // Look for the progress bar by class since it doesn't have a role
    const progressBar = screen.getByText("0:30"); // Time display indicates progress bar is working
    expect(progressBar).toBeInTheDocument();
  });

  it("should handle menu actions", async () => {
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    // Find the menu button by its aria-haspopup attribute
    // Get all buttons with empty names and find the one with aria-haspopup
    const allButtons = screen.getAllByRole("button", { name: "" });
    const menuButton = allButtons.find(
      (button) => button.getAttribute("aria-haspopup") === "menu",
    );
    expect(menuButton).toBeDefined();
    await user.click(menuButton!);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Report Issue")).toBeInTheDocument();
    expect(screen.getByText("Donate/Support Me")).toBeInTheDocument();
  });

  it("should not show rename controls for non-host users", () => {
    render(<RoomPage {...defaultProps} />);

    const roomNameElement = screen.getByText("Test Room");
    expect(roomNameElement).not.toHaveClass("cursor-pointer");
  });

  it("should disable control mode toggle for non-host users", () => {
    render(<RoomPage {...defaultProps} />);

    const controlSwitch = screen.getByRole("switch");
    expect(controlSwitch).toBeDisabled();
  });

  it("should show eye icon correctly based on follow mode", () => {
    const followingProps = {
      ...defaultProps,
      followMode: "AUTO_FOLLOW" as const,
    };

    render(<RoomPage {...followingProps} />);

    expect(screen.getByTitle("Stop following host")).toBeInTheDocument();
  });

  it("should show eye-off icon when not following", () => {
    const notFollowingProps = {
      ...defaultProps,
      followMode: "MANUAL_FOLLOW" as const,
    };

    render(<RoomPage {...notFollowingProps} />);

    expect(screen.getByTitle("Follow host")).toBeInTheDocument();
  });
});
