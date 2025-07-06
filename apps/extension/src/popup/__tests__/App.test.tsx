import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { App } from "../App";

describe("App Component", () => {
  it("should render without crashing", () => {
    render(<App />);

    // Just verify the component renders without errors
    expect(true).toBe(true);
  });

  it("should render with expected content", () => {
    const { getByText } = render(<App />);

    // Test actual component functionality (without jest-dom matchers for projects compatibility)
    expect(getByText("Watch Together")).toBeTruthy();
    expect(
      getByText("Chrome extension for synchronized video watching"),
    ).toBeTruthy();
  });
});
