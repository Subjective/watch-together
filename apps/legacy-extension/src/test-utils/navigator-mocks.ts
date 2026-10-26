/**
 * Navigator API mocks for testing
 * Provides type-safe mocks for browser APIs used in tests
 */
import { vi } from "vitest";

/**
 * Create a mock Navigator Clipboard API
 */
export const createClipboardMock = () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(""),
  write: vi.fn().mockResolvedValue(undefined),
  read: vi.fn().mockResolvedValue([]),
});

/**
 * Setup Navigator global for tests
 */
export const setupNavigatorGlobal = () => {
  const clipboardMock = createClipboardMock();

  // Preserve existing navigator properties and add clipboard mock
  Object.defineProperty(navigator, "clipboard", {
    value: clipboardMock,
    writable: true,
    configurable: true,
  });

  return { clipboard: clipboardMock };
};

/**
 * Reset Navigator mocks
 */
export const resetNavigatorMocks = (
  navigatorMock: ReturnType<typeof setupNavigatorGlobal>,
) => {
  vi.clearAllMocks();

  // Reset clipboard mock specifically
  navigatorMock.clipboard.writeText.mockResolvedValue(undefined);
  navigatorMock.clipboard.readText.mockResolvedValue("");
};

/**
 * Type-safe Navigator mock for testing
 */
export type NavigatorMock = ReturnType<typeof setupNavigatorGlobal>;
