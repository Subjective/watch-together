import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { App } from "../App";

describe("App Component", () => {
  it("should render without crashing", () => {
    render(<App />);

    // Just verify the component renders without errors
    expect(true).toBe(true);
  });

  it("should have chrome extension APIs available", () => {
    render(<App />);

    // Verify chrome API is available in test environment
    expect(global.chrome).toBeDefined();
    expect(global.chrome.runtime).toBeDefined();
  });
});
