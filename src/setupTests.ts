// Jest setup file for Chrome extension testing

// Mock Chrome APIs for testing
const mockChrome = {
  runtime: {
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    openOptionsPage: jest.fn()
  },
  tabs: {
    onCreated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    query: jest.fn().mockResolvedValue([])
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    }
  },
  notifications: {
    create: jest.fn()
  }
};

// Make chrome available globally in tests
(global as any).chrome = mockChrome;

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};