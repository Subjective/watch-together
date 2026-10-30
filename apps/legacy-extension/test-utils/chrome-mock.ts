import { vi } from "vitest";

export const MockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(),
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    id: "test-extension-id",
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
    insertCSS: vi.fn(),
    removeCSS: vi.fn(),
  },
};
