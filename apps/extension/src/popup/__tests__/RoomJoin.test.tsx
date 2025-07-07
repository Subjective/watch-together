/**
 * Tests for RoomJoin component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RoomJoin } from "../RoomJoin";

describe("RoomJoin", () => {
  const mockOnJoinRoom = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render room join form", () => {
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    expect(
      screen.getByRole("heading", { name: "Join Room" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Room ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join Room" }),
    ).toBeInTheDocument();
  });

  it("should show validation errors for empty fields", async () => {
    const user = userEvent.setup();
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    const submitButton = screen.getByRole("button", { name: "Join Room" });
    await user.click(submitButton);

    expect(screen.getByText("Room ID is required")).toBeInTheDocument();
    expect(screen.getByText("Your name is required")).toBeInTheDocument();
    expect(mockOnJoinRoom).not.toHaveBeenCalled();
  });

  it("should validate room ID format", async () => {
    const user = userEvent.setup();
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    const roomIdInput = screen.getByLabelText("Room ID");
    const submitButton = screen.getByRole("button", { name: "Join Room" });

    await user.type(roomIdInput, "abc");
    await user.click(submitButton);

    expect(
      screen.getByText("Room ID must be at least 6 characters"),
    ).toBeInTheDocument();
    expect(mockOnJoinRoom).not.toHaveBeenCalled();
  });

  it("should validate room ID characters", async () => {
    const user = userEvent.setup();
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    const roomIdInput = screen.getByLabelText("Room ID");
    const submitButton = screen.getByRole("button", { name: "Join Room" });

    await user.type(roomIdInput, "room@#$");
    await user.click(submitButton);

    expect(
      screen.getByText(
        "Room ID can only contain letters, numbers, and hyphens",
      ),
    ).toBeInTheDocument();
    expect(mockOnJoinRoom).not.toHaveBeenCalled();
  });

  it("should call onJoinRoom with valid input", async () => {
    const user = userEvent.setup();
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    const roomIdInput = screen.getByLabelText("Room ID");
    const userNameInput = screen.getByLabelText("Your Name");
    const submitButton = screen.getByRole("button", { name: "Join Room" });

    await user.type(roomIdInput, "room-123");
    await user.type(userNameInput, "John Doe");
    await user.click(submitButton);

    expect(mockOnJoinRoom).toHaveBeenCalledWith("room-123", "John Doe");
  });

  it("should call onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<RoomJoin onJoinRoom={mockOnJoinRoom} onBack={mockOnBack} />);

    const backButton = screen.getByLabelText("Go back");
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it("should disable form when loading", () => {
    render(
      <RoomJoin
        onJoinRoom={mockOnJoinRoom}
        onBack={mockOnBack}
        isLoading={true}
      />,
    );

    expect(screen.getByLabelText("Room ID")).toBeDisabled();
    expect(screen.getByLabelText("Your Name")).toBeDisabled();
    expect(screen.getByLabelText("Go back")).toBeDisabled();
    expect(screen.getByText("Joining Room...")).toBeInTheDocument();
  });
});
