/**
 * Tests for RoomCreate component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RoomCreate } from "../RoomCreate";

describe("RoomCreate", () => {
  const mockOnCreateRoom = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render room creation form", () => {
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    expect(
      screen.getByRole("heading", { name: "Create Room" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Room Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Room" }),
    ).toBeInTheDocument();
  });

  it("should show validation errors for empty fields", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const submitButton = screen.getByRole("button", { name: "Create Room" });
    await user.click(submitButton);

    expect(screen.getByText("Room name is required")).toBeInTheDocument();
    expect(screen.getByText("Your name is required")).toBeInTheDocument();
    expect(mockOnCreateRoom).not.toHaveBeenCalled();
  });

  it("should show validation errors for short input", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const roomNameInput = screen.getByLabelText("Room Name");
    const userNameInput = screen.getByLabelText("Your Name");
    const submitButton = screen.getByRole("button", { name: "Create Room" });

    await user.type(roomNameInput, "AB");
    await user.type(userNameInput, "A");
    await user.click(submitButton);

    expect(
      screen.getByText("Room name must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Name must be at least 2 characters"),
    ).toBeInTheDocument();
    expect(mockOnCreateRoom).not.toHaveBeenCalled();
  });

  it("should show validation errors for long input", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const roomNameInput = screen.getByLabelText("Room Name");
    const userNameInput = screen.getByLabelText("Your Name");
    const submitButton = screen.getByRole("button", { name: "Create Room" });

    await user.type(roomNameInput, "a".repeat(51));
    await user.type(userNameInput, "a".repeat(31));
    await user.click(submitButton);

    expect(
      screen.getByText("Room name must be less than 50 characters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Name must be less than 30 characters"),
    ).toBeInTheDocument();
    expect(mockOnCreateRoom).not.toHaveBeenCalled();
  });

  it("should call onCreateRoom with valid input", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const roomNameInput = screen.getByLabelText("Room Name");
    const userNameInput = screen.getByLabelText("Your Name");
    const submitButton = screen.getByRole("button", { name: "Create Room" });

    await user.type(roomNameInput, "Test Room");
    await user.type(userNameInput, "John Doe");
    await user.click(submitButton);

    expect(mockOnCreateRoom).toHaveBeenCalledWith("Test Room", "John Doe");
  });

  it("should clear validation errors when user starts typing", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const roomNameInput = screen.getByLabelText("Room Name");
    const submitButton = screen.getByRole("button", { name: "Create Room" });

    // Trigger validation error
    await user.click(submitButton);
    expect(screen.getByText("Room name is required")).toBeInTheDocument();

    // Start typing to clear error
    await user.type(roomNameInput, "Test");
    expect(screen.queryByText("Room name is required")).not.toBeInTheDocument();
  });

  it("should call onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const backButton = screen.getByLabelText("Go back");
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it("should disable form when loading", () => {
    render(
      <RoomCreate
        onCreateRoom={mockOnCreateRoom}
        onBack={mockOnBack}
        isLoading={true}
      />,
    );

    expect(screen.getByLabelText("Room Name")).toBeDisabled();
    expect(screen.getByLabelText("Your Name")).toBeDisabled();
    expect(screen.getByLabelText("Go back")).toBeDisabled();
    expect(screen.getByText("Creating Room...")).toBeInTheDocument();
  });

  it("should trim whitespace from inputs", async () => {
    const user = userEvent.setup();
    render(<RoomCreate onCreateRoom={mockOnCreateRoom} onBack={mockOnBack} />);

    const roomNameInput = screen.getByLabelText("Room Name");
    const userNameInput = screen.getByLabelText("Your Name");
    const submitButton = screen.getByRole("button", { name: "Create Room" });

    await user.type(roomNameInput, "  Test Room  ");
    await user.type(userNameInput, "  John Doe  ");
    await user.click(submitButton);

    expect(mockOnCreateRoom).toHaveBeenCalledWith("Test Room", "John Doe");
  });
});
