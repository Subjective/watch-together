/**
 * Tests for ControlModeToggle component
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ControlModeToggle } from "../ControlModeToggle";

describe("ControlModeToggle", () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render for non-host users", () => {
    const { container } = render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={false}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render for host users", () => {
    render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    expect(screen.getByText("Control Mode")).toBeInTheDocument();
    expect(
      screen.getByText("Only you can control playback"),
    ).toBeInTheDocument();
    expect(screen.getByText("Host-Only")).toBeInTheDocument();
    expect(screen.getByText("Free-For-All")).toBeInTheDocument();
  });

  it("should show correct text for HOST_ONLY mode", () => {
    render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    expect(
      screen.getByText("Only you can control playback"),
    ).toBeInTheDocument();
  });

  it("should show correct text for FREE_FOR_ALL mode", () => {
    render(
      <ControlModeToggle
        controlMode="FREE_FOR_ALL"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    expect(
      screen.getByText("Everyone can control playback"),
    ).toBeInTheDocument();
  });

  it("should call onToggle when clicked", async () => {
    const user = userEvent.setup();
    render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    const toggleButton = screen.getByLabelText("Switch to Free-For-All mode");
    await user.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalled();
  });

  it("should not call onToggle when disabled", async () => {
    const user = userEvent.setup();
    render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={true}
        disabled={true}
      />,
    );

    const toggleButton = screen.getByLabelText("Switch to Free-For-All mode");
    await user.click(toggleButton);

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it("should not call onToggle for non-host users", () => {
    render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={false}
      />,
    );

    // Component should not render at all for non-host users
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it("should show correct aria-label for different modes", () => {
    const { rerender } = render(
      <ControlModeToggle
        controlMode="HOST_ONLY"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    expect(
      screen.getByLabelText("Switch to Free-For-All mode"),
    ).toBeInTheDocument();

    rerender(
      <ControlModeToggle
        controlMode="FREE_FOR_ALL"
        onToggle={mockOnToggle}
        isHost={true}
      />,
    );

    expect(
      screen.getByLabelText("Switch to Host-Only mode"),
    ).toBeInTheDocument();
  });
});
