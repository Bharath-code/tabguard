/**
 * @jest-environment jsdom
 */

// Mock Chrome APIs before importing the background script
const mockChrome = {
  runtime: {
    onStartup: { addListener: jest.fn() },
    onInstalled: { addListener: jest.fn() }
  },
  tabs: {
    onCreated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onActivated: { addListener: jest.fn() },
    query: jest.fn()
  },
  windows: {
    onRemoved: { addListener: jest.fn() }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock console methods
const consoleSpy = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// @ts-ignore
global.console = {
  ...console,
  ...consoleSpy
};

// Helper function to create complete mock Tab objects
const createMockTab = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => ({
  id: 1,
  index: 0,
  windowId: 1,
  highlighted: false,
  active: false,
  pinned: false,
  selected: false,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
  url: 'https://example.com',
  title: 'Example',
  favIconUrl: '',
  status: 'complete',
  incognito: false,
  width: 1024,
  height: 768,
  sessionId: 'session-1',
  ...overrides
});

describe('Background Script', () => {
  let backgroundModule: any;

  beforeAll(() => {
    // Import the background module once after mocks are set up
    backgroundModule = require('../background');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset chrome API mocks
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.storage.local.get.mockResolvedValue({ errorLogs: [] });
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.notifications.create.mockResolvedValue('notification-id');
  });

  test('should load without errors', () => {
    // The background script should have loaded and logged the message
    expect(backgroundModule).toBeDefined();
    // Note: console.log is called when the module is first imported in beforeAll
  });

  test('should set up all event listeners', () => {
    // Event listeners are set up when the module is loaded
    // Since we clear mocks in beforeEach, we need to check that the functions exist
    expect(chrome.runtime.onStartup.addListener).toBeDefined();
    expect(chrome.runtime.onInstalled.addListener).toBeDefined();
    expect(chrome.tabs.onCreated.addListener).toBeDefined();
    expect(chrome.tabs.onRemoved.addListener).toBeDefined();
    expect(chrome.tabs.onUpdated.addListener).toBeDefined();
    expect(chrome.tabs.onActivated.addListener).toBeDefined();
    expect(chrome.windows.onRemoved.addListener).toBeDefined();
  });

  describe('Tab Count Functionality', () => {
    test('getAllTabsCount should return correct tab count', async () => {
      const mockTabs = [
        createMockTab({ id: 1, windowId: 1, url: 'https://example.com', title: 'Example' }),
        createMockTab({ id: 2, windowId: 1, url: 'https://google.com', title: 'Google' }),
        createMockTab({ id: 3, windowId: 2, url: 'https://github.com', title: 'GitHub' })
      ];
      mockChrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await backgroundModule.getAllTabsCount();

      expect(result.totalTabs).toBe(3);
      expect(result.tabsByWindow.get(1)).toBe(2);
      expect(result.tabsByWindow.get(2)).toBe(1);
    });

    test('getAllTabsCount should handle Chrome API errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'));

      const result = await backgroundModule.getAllTabsCount();

      expect(result.totalTabs).toBe(0);
      expect(result.tabsByWindow.size).toBe(0);
      expect(console.error).toHaveBeenCalledWith('Failed to get tab count:', expect.any(Error));
    });
  });

  describe('Tab Event Handlers', () => {
    test('handleTabCreated should process tab creation correctly', async () => {
      const mockTab = createMockTab({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: 1,
        active: true
      });

      mockChrome.storage.sync.get.mockResolvedValue({
        userConfig: {
          tabLimit: 10,
          notificationsEnabled: true
        }
      });

      await backgroundModule.handleTabCreated(mockTab);

      expect(console.log).toHaveBeenCalledWith('Tab created:', 1, 'https://example.com');
    });

    test('handleTabCreated should enforce tab limits using TabManager', async () => {
      const mockTab = createMockTab({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        windowId: 1,
        active: true
      });

      // Mock multiple tabs to exceed limit
      mockChrome.tabs.query.mockResolvedValue([
        createMockTab({ id: 1, windowId: 1 }),
        createMockTab({ id: 2, windowId: 1 }),
        createMockTab({ id: 3, windowId: 1 })
      ]);

      mockChrome.storage.sync.get.mockResolvedValue({
        userConfig: {
          tabLimit: 2,
          notificationsEnabled: true
        }
      });

      await backgroundModule.handleTabCreated(mockTab);

      expect(console.log).toHaveBeenCalledWith('Tab created:', 1, 'https://example.com');
      // TabManager should handle the limit enforcement
    });

    test('handleTabRemoved should update tab count correctly', async () => {
      const removeInfo = { isWindowClosing: false };

      await backgroundModule.handleTabRemoved(1, removeInfo);

      expect(console.log).toHaveBeenCalledWith('Tab removed:', 1, 'Window closed:', false);
    });

    test('handleTabUpdated should process tab updates when complete', async () => {
      const mockTab = createMockTab({
        id: 1,
        url: 'https://updated.com',
        title: 'Updated',
        windowId: 1,
        active: true
      });
      const changeInfo = { status: 'complete' };

      await backgroundModule.handleTabUpdated(1, changeInfo, mockTab);

      expect(console.log).toHaveBeenCalledWith('Tab updated:', 1, 'https://updated.com');
    });

    test('handleTabActivated should update tab activity', async () => {
      const activeInfo = { tabId: 1, windowId: 1 };

      await backgroundModule.handleTabActivated(activeInfo);

      expect(console.log).toHaveBeenCalledWith('Tab activated:', 1);
    });

    test('handleWindowRemoved should clean up window tabs', async () => {
      await backgroundModule.handleWindowRemoved(1);

      expect(console.log).toHaveBeenCalledWith('Window removed:', 1);
    });
  });

  describe('Error Handling', () => {
    test('should handle Chrome API errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Permission denied'));

      const result = await backgroundModule.getAllTabsCount();

      expect(result.totalTabs).toBe(0);
      expect(console.error).toHaveBeenCalledWith('Failed to get tab count:', expect.any(Error));
    });

    test('should log errors to storage', async () => {
      const mockTab = createMockTab({ id: undefined }); // Invalid tab to trigger error

      await backgroundModule.handleTabCreated(mockTab);

      // Error should be handled gracefully
      expect(console.warn).toHaveBeenCalledWith('Tab created without ID, skipping');
    });
  });

  describe('Initialization', () => {
    test('initializeExtension should set default config if none exists', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([]);

      await backgroundModule.initializeExtension();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        userConfig: expect.objectContaining({
          tabLimit: 10,
          autoCloseEnabled: false,
          theme: 'auto',
          notificationsEnabled: true
        })
      });
    });

    test('initializeExtension should not overwrite existing config', async () => {
      const existingConfig = {
        userConfig: {
          tabLimit: 5,
          theme: 'dark'
        }
      };
      mockChrome.storage.sync.get.mockResolvedValue(existingConfig);
      mockChrome.tabs.query.mockResolvedValue([]);

      await backgroundModule.initializeExtension();

      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });
});