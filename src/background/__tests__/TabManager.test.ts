/**
 * @jest-environment jsdom
 */

import { TabManager } from '../TabManager';
import { UserConfig } from '../../shared/types';

// Mock Chrome APIs
const mockChrome = {
    tabs: {
        query: jest.fn(),
        remove: jest.fn()
    },
    storage: {
        sync: {
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

describe('TabManager', () => {
    let tabManager: TabManager;
    let mockUserConfig: UserConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset chrome API mocks
        mockChrome.tabs.query.mockResolvedValue([]);
        mockChrome.tabs.remove.mockResolvedValue(undefined);
        mockChrome.storage.sync.get.mockResolvedValue({});
        mockChrome.storage.sync.set.mockResolvedValue(undefined);
        mockChrome.notifications.create.mockResolvedValue('notification-id');

        // Default user config
        mockUserConfig = {
            tabLimit: 5,
            autoCloseEnabled: false,
            autoCloseDelay: 30,
            theme: 'auto',
            notificationsEnabled: true,
            rules: [],
            profiles: []
        };

        tabManager = new TabManager();
    });

    describe('Tab Count Management', () => {
        test('getCurrentTabCount should return correct count from Chrome API', async () => {
            const mockTabs = [
                createMockTab({ id: 1, windowId: 1, url: 'https://example.com', title: 'Example' }),
                createMockTab({ id: 2, windowId: 1, url: 'https://google.com', title: 'Google' }),
                createMockTab({ id: 3, windowId: 2, url: 'https://github.com', title: 'GitHub' })
            ];
            mockChrome.tabs.query.mockResolvedValue(mockTabs);

            const count = await tabManager.getCurrentTabCount();

            expect(count).toBe(3);
            expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
        });

        test('getCurrentTabCount should handle Chrome API errors gracefully', async () => {
            mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'));

            const count = await tabManager.getCurrentTabCount();

            expect(count).toBe(0); // Should return internal count on error
            expect(console.error).toHaveBeenCalledWith('Failed to get current tab count:', expect.any(Error));
        });
    });

    describe('Tab Limit Enforcement', () => {
        test('enforceTabLimit should allow tabs when under limit', async () => {
            mockChrome.tabs.query.mockResolvedValue([
                createMockTab({ id: 1, windowId: 1, url: 'https://example.com' }),
                createMockTab({ id: 2, windowId: 1, url: 'https://google.com' })
            ]);
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: mockUserConfig });

            const result = await tabManager.enforceTabLimit();

            expect(result.allowed).toBe(true);
            expect(result.currentCount).toBe(2);
            expect(result.limit).toBe(5);
            expect(result.message).toBeUndefined();
        });

        test('enforceTabLimit should block tabs when limit exceeded', async () => {
            const mockTabs = Array.from({ length: 6 }, (_, i) =>
                createMockTab({
                    id: i + 1,
                    windowId: 1,
                    url: `https://example${i}.com`,
                    title: `Example ${i}`
                })
            );
            mockChrome.tabs.query.mockResolvedValue(mockTabs);
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: mockUserConfig });

            const result = await tabManager.enforceTabLimit();

            expect(result.allowed).toBe(false);
            expect(result.currentCount).toBe(6);
            expect(result.limit).toBe(5);
            expect(result.message).toBe('Tab limit reached: 6/5 tabs open');

            // Should close the most recent tab (highest ID)
            expect(mockChrome.tabs.remove).toHaveBeenCalledWith(6);

            // Should show notification
            expect(mockChrome.notifications.create).toHaveBeenCalledWith({
                type: 'basic',
                iconUrl: '/icons/icon48.png',
                title: 'TabGuard Pro - Tab Limit Exceeded',
                message: 'Tab limit exceeded! You have 6 tabs open (limit: 5). The newest tab was automatically closed.',
                priority: 2
            });
        });

        test('enforceTabLimit should not show notification when disabled', async () => {
            const mockTabs = Array.from({ length: 6 }, (_, i) =>
                createMockTab({
                    id: i + 1,
                    windowId: 1,
                    url: `https://example${i}.com`
                })
            );
            mockChrome.tabs.query.mockResolvedValue(mockTabs);

            const configWithoutNotifications = { ...mockUserConfig, notificationsEnabled: false };
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: configWithoutNotifications });

            const result = await tabManager.enforceTabLimit();

            expect(result.allowed).toBe(false);
            expect(mockChrome.notifications.create).not.toHaveBeenCalled();
        });

        test('enforceTabLimit should use custom limit when provided', async () => {
            mockChrome.tabs.query.mockResolvedValue([
                createMockTab({ id: 1, windowId: 1 }),
                createMockTab({ id: 2, windowId: 1 }),
                createMockTab({ id: 3, windowId: 1 })
            ]);

            const result = await tabManager.enforceTabLimit(2);

            expect(result.allowed).toBe(false);
            expect(result.limit).toBe(2);
            expect(result.currentCount).toBe(3);
        });

        test('enforceTabLimit should handle Chrome API errors gracefully', async () => {
            mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'));
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: mockUserConfig });

            const result = await tabManager.enforceTabLimit();

            // Should still work with internal count (0 initially)
            expect(result.allowed).toBe(true);
            expect(result.currentCount).toBe(0);
            expect(result.limit).toBe(5);
            expect(console.error).toHaveBeenCalledWith('Failed to get current tab count:', expect.any(Error));
        });
    });

    describe('Tab Metadata Management', () => {
        test('addTab should add tab metadata correctly', () => {
            const mockTab = createMockTab({
                id: 1,
                url: 'https://example.com',
                title: 'Example',
                windowId: 1,
                active: true
            });

            tabManager.addTab(mockTab);

            const metadata = tabManager.getTabMetadata();
            expect(metadata.has(1)).toBe(true);

            const tabData = metadata.get(1);
            expect(tabData).toMatchObject({
                id: 1,
                url: 'https://example.com',
                title: 'Example',
                windowId: 1,
                isActive: true
            });
            expect(tabData?.createdAt).toBeInstanceOf(Date);
            expect(tabData?.lastAccessed).toBeInstanceOf(Date);
        });

        test('addTab should skip tabs without ID', () => {
            const mockTab = createMockTab({
                id: undefined, // No ID to test the skip behavior
                url: 'https://example.com',
                title: 'Example',
                windowId: 1,
                active: true
            });

            tabManager.addTab(mockTab);

            const metadata = tabManager.getTabMetadata();
            expect(metadata.size).toBe(0);
        });

        test('removeTab should remove tab metadata', () => {
            const mockTab = createMockTab({ id: 1, url: 'https://example.com', windowId: 1, active: false });

            tabManager.addTab(mockTab);
            expect(tabManager.getTabMetadata().has(1)).toBe(true);

            tabManager.removeTab(1);
            expect(tabManager.getTabMetadata().has(1)).toBe(false);
        });

        test('updateTab should update existing tab metadata', () => {
            const mockTab = createMockTab({ id: 1, url: 'https://example.com', title: 'Example', windowId: 1, active: false });

            tabManager.addTab(mockTab);

            tabManager.updateTab(1, {
                url: 'https://updated.com',
                title: 'Updated Title',
                isActive: true
            });

            const metadata = tabManager.getTabMetadata().get(1);
            expect(metadata?.url).toBe('https://updated.com');
            expect(metadata?.title).toBe('Updated Title');
            expect(metadata?.isActive).toBe(true);
            expect(metadata?.lastAccessed).toBeInstanceOf(Date);
        });

        test('updateTab should not create new metadata for non-existent tab', () => {
            tabManager.updateTab(999, { url: 'https://test.com' });

            expect(tabManager.getTabMetadata().has(999)).toBe(false);
        });

        test('setActiveTab should mark correct tab as active', () => {
            const tabs = [
                createMockTab({ id: 1, windowId: 1, url: 'https://example1.com', active: false }),
                createMockTab({ id: 2, windowId: 1, url: 'https://example2.com', active: false }),
                createMockTab({ id: 3, windowId: 2, url: 'https://example3.com', active: false })
            ];

            tabs.forEach(tab => tabManager.addTab(tab));

            tabManager.setActiveTab(2, 1);

            const metadata = tabManager.getTabMetadata();
            expect(metadata.get(1)?.isActive).toBe(false);
            expect(metadata.get(2)?.isActive).toBe(true);
            expect(metadata.get(3)?.isActive).toBe(false); // Different window, unchanged
        });

        test('removeWindow should remove all tabs from window', () => {
            const tabs = [
                createMockTab({ id: 1, windowId: 1, url: 'https://example1.com', active: false }),
                createMockTab({ id: 2, windowId: 1, url: 'https://example2.com', active: false }),
                createMockTab({ id: 3, windowId: 2, url: 'https://example3.com', active: false })
            ];

            tabs.forEach(tab => tabManager.addTab(tab));

            tabManager.removeWindow(1);

            const metadata = tabManager.getTabMetadata();
            expect(metadata.has(1)).toBe(false);
            expect(metadata.has(2)).toBe(false);
            expect(metadata.has(3)).toBe(true); // Different window, should remain
        });
    });

    describe('Tab Suggestions', () => {
        test('getSuggestedTabsToClose should return inactive tabs older than 30 minutes', async () => {
            const now = new Date();
            const oldTime = new Date(now.getTime() - 35 * 60 * 1000); // 35 minutes ago
            const recentTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

            // Add tabs with different last accessed times
            tabManager.addTab(createMockTab({ id: 1, url: 'https://old.com', title: 'Old Tab', windowId: 1, active: false }));
            tabManager.addTab(createMockTab({ id: 2, url: 'https://recent.com', title: 'Recent Tab', windowId: 1, active: false }));
            tabManager.addTab(createMockTab({ id: 3, url: 'https://active.com', title: 'Active Tab', windowId: 1, active: true }));

            // Manually set last accessed times
            const metadata = tabManager.getTabMetadata();
            const oldTab = metadata.get(1);
            const recentTab = metadata.get(2);

            if (oldTab) {
                oldTab.lastAccessed = oldTime;
                tabManager.getTabMetadata().set(1, oldTab);
            }

            if (recentTab) {
                recentTab.lastAccessed = recentTime;
                tabManager.getTabMetadata().set(2, recentTab);
            }

            const suggestions = await tabManager.getSuggestedTabsToClose();

            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].tabId).toBe(1);
            expect(suggestions[0].title).toBe('Old Tab');
            expect(suggestions[0].url).toBe('https://old.com');
            expect(suggestions[0].productivityScore).toBe(5); // Default score
        });

        test('getSuggestedTabsToClose should calculate productivity scores correctly', async () => {
            const oldTime = new Date(Date.now() - 35 * 60 * 1000);

            // Add tabs with different productivity levels
            tabManager.addTab(createMockTab({ id: 1, url: 'https://github.com/project', title: 'GitHub', windowId: 1, active: false }));
            tabManager.addTab(createMockTab({ id: 2, url: 'https://facebook.com', title: 'Facebook', windowId: 1, active: false }));
            tabManager.addTab(createMockTab({ id: 3, url: 'https://youtube.com', title: 'YouTube', windowId: 1, active: false }));

            // Set all as old
            const metadata = tabManager.getTabMetadata();
            [1, 2, 3].forEach(id => {
                const tab = metadata.get(id);
                if (tab) {
                    tab.lastAccessed = oldTime;
                    metadata.set(id, tab);
                }
            });

            const suggestions = await tabManager.getSuggestedTabsToClose();

            expect(suggestions).toHaveLength(3);

            const githubSuggestion = suggestions.find(s => s.tabId === 1);
            const facebookSuggestion = suggestions.find(s => s.tabId === 2);
            const youtubeSuggestion = suggestions.find(s => s.tabId === 3);

            expect(githubSuggestion?.productivityScore).toBe(8); // Productive
            expect(facebookSuggestion?.productivityScore).toBe(2); // Social
            expect(youtubeSuggestion?.productivityScore).toBe(1); // Entertainment
        });

        test('getSuggestedTabsToClose should handle errors gracefully', async () => {
            // Add a tab first
            tabManager.addTab(createMockTab({ id: 1, url: 'https://test.com', title: 'Test', windowId: 1, active: false }));

            // Force an error by making the tabMetadata.values() throw
            const originalTabMetadata = (tabManager as any).tabMetadata;
            (tabManager as any).tabMetadata = {
                values: () => {
                    throw new Error('Test error');
                }
            };

            const suggestions = await tabManager.getSuggestedTabsToClose();

            expect(suggestions).toEqual([]);
            expect(console.error).toHaveBeenCalledWith('Failed to get suggested tabs to close:', expect.any(Error));

            // Restore original metadata
            (tabManager as any).tabMetadata = originalTabMetadata;
        });
    });

    describe('Initialization', () => {
        test('initializeFromExistingTabs should populate metadata from Chrome API', async () => {
            const mockTabs = [
                createMockTab({ id: 1, url: 'https://example1.com', title: 'Example 1', windowId: 1, active: true }),
                createMockTab({ id: 2, url: 'https://example2.com', title: 'Example 2', windowId: 1, active: false }),
                createMockTab({ id: 3, url: 'https://example3.com', title: 'Example 3', windowId: 2, active: true })
            ];
            mockChrome.tabs.query.mockResolvedValue(mockTabs);

            await tabManager.initializeFromExistingTabs();

            const metadata = tabManager.getTabMetadata();
            expect(metadata.size).toBe(3);
            expect(metadata.has(1)).toBe(true);
            expect(metadata.has(2)).toBe(true);
            expect(metadata.has(3)).toBe(true);

            const count = await tabManager.getCurrentTabCount();
            expect(count).toBe(3);
        });

        test('initializeFromExistingTabs should handle Chrome API errors', async () => {
            mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'));

            await tabManager.initializeFromExistingTabs();

            expect(console.error).toHaveBeenCalledWith('Failed to initialize tab tracking:', expect.any(Error));
            expect(tabManager.getTabMetadata().size).toBe(0);
        });
    });

    describe('Configuration Management', () => {
        test('updateConfig should update internal configuration', () => {
            const newConfig: UserConfig = {
                tabLimit: 15,
                autoCloseEnabled: true,
                autoCloseDelay: 60,
                theme: 'dark',
                notificationsEnabled: false,
                rules: [],
                profiles: []
            };

            tabManager.updateConfig(newConfig);

            // Test that the config is used by checking enforcement behavior
            expect(() => tabManager.updateConfig(newConfig)).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle notification creation errors gracefully', async () => {
            mockChrome.tabs.query.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ id: i + 1 })));
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: mockUserConfig });
            mockChrome.notifications.create.mockRejectedValue(new Error('Notification error'));

            const result = await tabManager.enforceTabLimit();

            expect(result.allowed).toBe(false);
            expect(console.error).toHaveBeenCalledWith('Failed to show limit violation notification:', expect.any(Error));
        });

        test('should handle tab removal errors gracefully', async () => {
            mockChrome.tabs.query.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ id: i + 1 })));
            mockChrome.storage.sync.get.mockResolvedValue({ userConfig: mockUserConfig });
            mockChrome.tabs.remove.mockRejectedValue(new Error('Tab removal error'));

            const result = await tabManager.enforceTabLimit();

            expect(result.allowed).toBe(false);
            expect(console.error).toHaveBeenCalledWith('Failed to block new tab:', expect.any(Error));
        });
    });
});