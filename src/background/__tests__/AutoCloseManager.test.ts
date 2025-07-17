/**
 * Tests for AutoCloseManager
 * 
 * Tests the auto-close functionality, whitelist mechanism, and undo capabilities
 */

import { AutoCloseManager, WhitelistEntry, ClosedTabInfo } from '../AutoCloseManager';
import { TabActivityTracker } from '../TabActivityTracker';
import { TabSuggestionEngine } from '../TabSuggestionEngine';

// Mock chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    remove: jest.fn(),
    create: jest.fn()
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
    create: jest.fn(),
    clear: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onButtonClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
} as unknown as typeof chrome;

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');
const MockTabActivityTracker = TabActivityTracker as jest.MockedClass<typeof TabActivityTracker>;

// Mock TabSuggestionEngine
jest.mock('../TabSuggestionEngine');
const MockTabSuggestionEngine = TabSuggestionEngine as jest.MockedClass<typeof TabSuggestionEngine>;

describe('AutoCloseManager', () => {
  let autoCloseManager: AutoCloseManager;
  let mockActivityTracker: jest.Mocked<TabActivityTracker>;
  let mockSuggestionEngine: jest.Mocked<TabSuggestionEngine>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock storage
    (chrome.storage.sync.get as jest.Mock).mockImplementation((key, callback) => {
      if (callback) {
        callback({ autoCloseWhitelist: [] });
      }
      return Promise.resolve({ autoCloseWhitelist: [] });
    });

    (chrome.storage.local.get as jest.Mock).mockImplementation((key, callback) => {
      if (callback) {
        callback({ autoCloseHistory: [] });
      }
      return Promise.resolve({ autoCloseHistory: [] });
    });

    // Setup mock activity tracker
    mockActivityTracker = new MockTabActivityTracker() as jest.Mocked<TabActivityTracker>;

    // Setup mock suggestion engine
    mockSuggestionEngine = new MockTabSuggestionEngine(mockActivityTracker) as jest.Mocked<TabSuggestionEngine>;
    mockSuggestionEngine.getSuggestions.mockResolvedValue([
      {
        tabId: 1,
        title: 'Test Tab 1',
        url: 'https://example.com',
        lastAccessed: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        memoryUsage: 100000,
        productivityScore: 3,
        closureScore: 8.5,
        inactivityScore: 7,
        memoryScore: 5,
        inactiveMinutes: 60,
        category: 'entertainment',
        isPinned: false
      },
      {
        tabId: 2,
        title: 'Test Tab 2',
        url: 'https://example.org',
        lastAccessed: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        memoryUsage: 80000,
        productivityScore: 5,
        closureScore: 7.2,
        inactivityScore: 6,
        memoryScore: 4,
        inactiveMinutes: 45,
        category: 'other',
        isPinned: false
      }
    ]);

    // Create AutoCloseManager instance
    autoCloseManager = new AutoCloseManager(mockActivityTracker, mockSuggestionEngine, {
      enabled: false, // Start disabled for most tests
      inactivityThreshold: 30,
      maxTabsToClose: 3,
      showNotifications: true,
      notificationDelay: 30,
      excludePinnedTabs: true,
      excludeWorkTabs: true
    });
  });

  afterEach(() => {
    autoCloseManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const manager = new AutoCloseManager(mockActivityTracker, mockSuggestionEngine);
      const options = manager.getOptions();

      expect(options.enabled).toBe(false);
      expect(options.inactivityThreshold).toBe(30);
      expect(options.maxTabsToClose).toBe(3);
      expect(options.showNotifications).toBe(true);
      expect(options.notificationDelay).toBe(30);
      expect(options.excludePinnedTabs).toBe(true);
      expect(options.excludeWorkTabs).toBe(true);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        enabled: true,
        inactivityThreshold: 60,
        maxTabsToClose: 5,
        showNotifications: false,
        notificationDelay: 10,
        excludePinnedTabs: false,
        excludeWorkTabs: false
      };

      const manager = new AutoCloseManager(mockActivityTracker, mockSuggestionEngine, customOptions);
      const options = manager.getOptions();

      expect(options).toEqual(customOptions);
    });

    it('should initialize from user config', async () => {
      const userConfig = {
        tabLimit: 25,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark' as const,
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      await autoCloseManager.initialize(userConfig);
      const options = autoCloseManager.getOptions();

      expect(options.enabled).toBe(true);
      expect(options.inactivityThreshold).toBe(45);
    });
  });

  describe('whitelist management', () => {
    it('should add entries to whitelist', async () => {
      const entry = {
        type: 'domain' as const,
        value: 'example.com',
        name: 'Example Domain'
      };

      const result = await autoCloseManager.addToWhitelist(entry);
      expect(result).toBe(true);

      const whitelist = autoCloseManager.getWhitelist();
      expect(whitelist).toHaveLength(1);
      expect(whitelist[0].value).toBe('example.com');
      expect(whitelist[0].name).toBe('Example Domain');
      expect(whitelist[0].addedAt).toBeInstanceOf(Date);

      // Verify storage was updated
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCloseWhitelist: expect.arrayContaining([
            expect.objectContaining({
              type: 'domain',
              value: 'example.com'
            })
          ])
        })
      );
    });

    it('should not add duplicate entries to whitelist', async () => {
      // Add first entry
      await autoCloseManager.addToWhitelist({
        type: 'domain',
        value: 'example.com'
      });

      // Try to add duplicate
      const result = await autoCloseManager.addToWhitelist({
        type: 'domain',
        value: 'example.com'
      });

      expect(result).toBe(false);

      const whitelist = autoCloseManager.getWhitelist();
      expect(whitelist).toHaveLength(1);
    });

    it('should remove entries from whitelist', async () => {
      // Add entries
      await autoCloseManager.addToWhitelist({
        type: 'domain',
        value: 'example.com'
      });

      await autoCloseManager.addToWhitelist({
        type: 'url',
        value: 'https://test.com/page'
      });

      // Remove one entry
      const result = await autoCloseManager.removeFromWhitelist('domain', 'example.com');
      expect(result).toBe(true);

      const whitelist = autoCloseManager.getWhitelist();
      expect(whitelist).toHaveLength(1);
      expect(whitelist[0].type).toBe('url');
      expect(whitelist[0].value).toBe('https://test.com/page');

      // Verify storage was updated
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCloseWhitelist: expect.arrayContaining([
            expect.objectContaining({
              type: 'url',
              value: 'https://test.com/page'
            })
          ])
        })
      );
    });

    it('should check if URL is whitelisted', async () => {
      // Add whitelist entries
      await autoCloseManager.addToWhitelist({
        type: 'domain',
        value: 'example.com'
      });

      await autoCloseManager.addToWhitelist({
        type: 'url',
        value: 'https://test.com/specific-page'
      });

      await autoCloseManager.addToWhitelist({
        type: 'pattern',
        value: '.*\\.github\\.io'
      });

      // Test domain matching
      expect(autoCloseManager.isWhitelisted('https://example.com')).toBe(true);
      expect(autoCloseManager.isWhitelisted('https://sub.example.com')).toBe(true);
      expect(autoCloseManager.isWhitelisted('https://example.org')).toBe(false);

      // Test exact URL matching
      expect(autoCloseManager.isWhitelisted('https://test.com/specific-page')).toBe(true);
      expect(autoCloseManager.isWhitelisted('https://test.com/other-page')).toBe(false);

      // Test pattern matching
      expect(autoCloseManager.isWhitelisted('https://user.github.io')).toBe(true);
      expect(autoCloseManager.isWhitelisted('https://github.com')).toBe(false);
    });
  });

  describe('auto-close functionality', () => {
    beforeEach(() => {
      // Mock setTimeout and clearTimeout
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start and stop auto-close timer based on enabled state', () => {
      // Initially disabled
      expect(autoCloseManager.getOptions().enabled).toBe(false);

      // Enable auto-close
      autoCloseManager.updateOptions({ enabled: true });
      expect(autoCloseManager.getOptions().enabled).toBe(true);

      // Disable auto-close
      autoCloseManager.updateOptions({ enabled: false });
      expect(autoCloseManager.getOptions().enabled).toBe(false);
    });

    it('should check for tabs to close when enabled', async () => {
      // Setup mock for chrome.tabs.remove
      (chrome.tabs.remove as jest.Mock).mockResolvedValue(undefined);

      // Enable auto-close
      autoCloseManager.updateOptions({
        enabled: true,
        showNotifications: false // Skip notification delay for testing
      });

      // Trigger the check (normally done by timer)
      await autoCloseManager.testCheckForTabsToClose();

      // Verify suggestion engine was called with correct parameters
      expect(mockSuggestionEngine.getSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          minInactivityMinutes: 30,
          includePinnedTabs: false,
          excludeWorkTabs: true
        })
      );

      // Verify tabs were closed
      expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
    });

    it('should not close whitelisted tabs', async () => {
      // Setup mock for chrome.tabs.remove
      (chrome.tabs.remove as jest.Mock).mockResolvedValue(undefined);

      // Add whitelist entry
      await autoCloseManager.addToWhitelist({
        type: 'domain',
        value: 'example.com'
      });

      // Enable auto-close
      autoCloseManager.updateOptions({
        enabled: true,
        showNotifications: false // Skip notification delay for testing
      });

      // Trigger the check (normally done by timer)
      await autoCloseManager.testCheckForTabsToClose();

      // Verify only non-whitelisted tabs were closed
      expect(chrome.tabs.remove).toHaveBeenCalledWith([2]);
    });

    it('should show notification before closing tabs when configured', async () => {
      // Enable auto-close with notifications
      autoCloseManager.updateOptions({
        enabled: true,
        showNotifications: true,
        notificationDelay: 30
      });

      // Trigger the check
      await autoCloseManager.testCheckForTabsToClose();

      // Verify notification was created
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          title: 'TabGuard Pro - Auto-Close',
          message: expect.stringContaining('will be closed in 30 seconds')
        }),
        expect.any(Function)
      );

      // Verify tabs were not closed immediately
      expect(chrome.tabs.remove).not.toHaveBeenCalled();

      // Fast-forward time to trigger the delayed closure
      jest.advanceTimersByTime(31000);

      // Verify tabs were closed after delay
      expect(chrome.tabs.remove).toHaveBeenCalled();
    });
  });

  describe('undo functionality', () => {
    beforeEach(() => {
      // Setup closed tabs history
      const closedTabs: ClosedTabInfo[] = [
        {
          tabId: 1,
          title: 'Test Tab 1',
          url: 'https://example.com',
          closedAt: new Date(),
          inactiveMinutes: 60
        },
        {
          tabId: 2,
          title: 'Test Tab 2',
          url: 'https://example.org',
          closedAt: new Date(),
          inactiveMinutes: 45
        }
      ];

      // Use the test helper method to set closed tabs
      autoCloseManager.testSetClosedTabs(closedTabs);
    });

    it('should restore recently closed tabs', async () => {
      // Setup mock for chrome.tabs.create
      (chrome.tabs.create as jest.Mock).mockResolvedValue({} as chrome.tabs.Tab);

      // Undo last closure
      const result = await autoCloseManager.undoLastClosure();

      // Verify result
      expect(result).toBe(true);

      // Verify tabs were created
      expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          active: false
        })
      );
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.org',
          active: false
        })
      );

      // Verify closed tabs were removed from history
      expect(autoCloseManager.getClosedTabs()).toHaveLength(0);
    });

    it('should return false when no tabs to restore', async () => {
      // Clear closed tabs
      autoCloseManager.testSetClosedTabs([]);

      // Try to undo
      const result = await autoCloseManager.undoLastClosure();

      // Verify result
      expect(result).toBe(false);

      // Verify no tabs were created
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
  });

  describe('option updates', () => {
    it('should update options', () => {
      const newOptions = {
        enabled: true,
        inactivityThreshold: 60,
        maxTabsToClose: 5
      };

      autoCloseManager.updateOptions(newOptions);

      const options = autoCloseManager.getOptions();
      expect(options.enabled).toBe(true);
      expect(options.inactivityThreshold).toBe(60);
      expect(options.maxTabsToClose).toBe(5);
      // Other options should remain unchanged
      expect(options.showNotifications).toBe(true);
      expect(options.notificationDelay).toBe(30);
    });

    it('should update from user config', () => {
      const userConfig = {
        tabLimit: 25,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark' as const,
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      autoCloseManager.updateFromConfig(userConfig);

      const options = autoCloseManager.getOptions();
      expect(options.enabled).toBe(true);
      expect(options.inactivityThreshold).toBe(45);
    });
  });
});