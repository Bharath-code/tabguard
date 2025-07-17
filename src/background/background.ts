// Background service worker for TabGuard Pro
// Main entry point for tab management and extension coordination

import { TabManager } from './TabManager';
import { StorageManager } from '../shared/StorageManager';
import { TabActivityTracker } from './TabActivityTracker';
import { TabSuggestionEngine } from './TabSuggestionEngine';
import { AutoCloseManager } from './AutoCloseManager';

console.log('TabGuard Pro background service worker loaded');

// Initialize TabManager, TabActivityTracker, TabSuggestionEngine and StorageManager instances
const tabManager = new TabManager();
const tabActivityTracker = new TabActivityTracker();
const tabSuggestionEngine = new TabSuggestionEngine(tabActivityTracker);
const storageManager = new StorageManager();
const autoCloseManager = new AutoCloseManager(tabActivityTracker, tabSuggestionEngine);

interface TabCountResult {
    totalTabs: number;
    tabsByWindow: Map<number, number>;
}

// Initialize extension on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('TabGuard Pro extension started');
    initializeExtension();
});

// Add notification click listener
chrome.notifications.onClicked.addListener((notificationId) => {
    console.log('Notification clicked:', notificationId);
    // Open the extension popup when a notification is clicked
    chrome.action.openPopup();
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
    console.log('TabGuard Pro extension installed/updated:', details.reason);
    initializeExtension();
});

// Tab event listeners with comprehensive error handling
chrome.tabs.onCreated.addListener((tab) => {
    handleTabCreated(tab).catch(error => {
        console.error('Error handling tab creation:', error);
        logError('TAB_CREATED', error, { tabId: tab.id, url: tab.url });
    });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    handleTabRemoved(tabId, removeInfo).catch(error => {
        console.error('Error handling tab removal:', error);
        logError('TAB_REMOVED', error, { tabId, removeInfo });
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    handleTabUpdated(tabId, changeInfo, tab).catch(error => {
        console.error('Error handling tab update:', error);
        logError('TAB_UPDATED', error, { tabId, changeInfo, url: tab.url });
    });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    handleTabActivated(activeInfo).catch(error => {
        console.error('Error handling tab activation:', error);
        logError('TAB_ACTIVATED', error, activeInfo);
    });
});

chrome.windows.onRemoved.addListener((windowId) => {
    handleWindowRemoved(windowId).catch(error => {
        console.error('Error handling window removal:', error);
        logError('WINDOW_REMOVED', error, { windowId });
    });
});

// Core initialization function
async function initializeExtension(): Promise<void> {
    try {
        // Initialize StorageManager with default configuration
        await storageManager.initialize();
        console.log('StorageManager initialized successfully');

        // Initialize tab count and metadata
        await initializeTabTracking();
        
        // Initialize AutoCloseManager with user configuration
        const { userConfig } = await chrome.storage.sync.get('userConfig');
        if (userConfig) {
            await autoCloseManager.initialize(userConfig);
            console.log('AutoCloseManager initialized successfully');
        }

        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize extension:', error);
        logError('INITIALIZATION', error);
    }
}

// Initialize tab tracking using TabManager and TabActivityTracker
async function initializeTabTracking(): Promise<void> {
    try {
        // Initialize TabManager
        await tabManager.initializeFromExistingTabs();
        const currentCount = await tabManager.getCurrentTabCount();

        // Initialize TabActivityTracker
        await tabActivityTracker.initializeFromExistingTabs();
        const activitySummary = tabActivityTracker.getActivitySummary();

        console.log(`Initialized tab tracking: ${currentCount} tabs`);
        console.log(`Tab activity tracking initialized: ${activitySummary.totalTabs} tabs, ${activitySummary.activeTabs} active`);
    } catch (error) {
        console.error('Failed to initialize tab tracking:', error);
        logError('TAB_TRACKING_INIT', error);
    }
}

// Get comprehensive tab count across all windows
async function getAllTabsCount(): Promise<TabCountResult> {
    try {
        const allTabs = await chrome.tabs.query({});
        const tabsByWindow = new Map<number, number>();

        for (const tab of allTabs) {
            const windowId = tab.windowId;
            tabsByWindow.set(windowId, (tabsByWindow.get(windowId) || 0) + 1);
        }

        return {
            totalTabs: allTabs.length,
            tabsByWindow
        };
    } catch (error) {
        console.error('Failed to get tab count:', error);
        logError('GET_TAB_COUNT', error);
        return { totalTabs: 0, tabsByWindow: new Map() };
    }
}

// Tab event handlers with full implementation
async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    try {
        console.log('Tab created:', tab.id, tab.url);

        if (!tab.id) {
            console.warn('Tab created without ID, skipping');
            return;
        }

        // Add tab to TabManager
        tabManager.addTab(tab);

        // Add tab to TabActivityTracker
        tabActivityTracker.trackTab(tab);

        // Enforce tab limit using TabManager
        const limitResult = await tabManager.enforceTabLimit();

        if (!limitResult.allowed) {
            console.log(`Tab limit enforcement: ${limitResult.message}`);
        }

        console.log(`Current tab count: ${limitResult.currentCount}`);
    } catch (error) {
        console.error('Error in handleTabCreated:', error);
        logError('HANDLE_TAB_CREATED', error, { tabId: tab.id });
    }
}

async function handleTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): Promise<void> {
    try {
        console.log('Tab removed:', tabId, 'Window closed:', removeInfo.isWindowClosing);

        // Remove tab from TabManager (only if window is not closing to avoid double counting)
        if (!removeInfo.isWindowClosing) {
            tabManager.removeTab(tabId);

            // Also remove from TabActivityTracker
            tabActivityTracker.removeTab(tabId);
        }

        const currentCount = await tabManager.getCurrentTabCount();
        console.log(`Current tab count: ${currentCount}`);
    } catch (error) {
        console.error('Error in handleTabRemoved:', error);
        logError('HANDLE_TAB_REMOVED', error, { tabId, removeInfo });
    }
}

async function handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    try {
        // Only process when tab loading is complete
        if (changeInfo.status !== 'complete') {
            return;
        }

        console.log('Tab updated:', tabId, tab.url);

        // Update tab metadata using TabManager
        tabManager.updateTab(tabId, {
            url: tab.url || '',
            title: tab.title || '',
            isActive: tab.active || false
        });

        // Update tab in TabActivityTracker
        tabActivityTracker.updateTab(tabId, changeInfo, tab);
    } catch (error) {
        console.error('Error in handleTabUpdated:', error);
        logError('HANDLE_TAB_UPDATED', error, { tabId, changeInfo });
    }
}

async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    try {
        console.log('Tab activated:', activeInfo.tabId);

        // Update tab activity using TabManager
        tabManager.setActiveTab(activeInfo.tabId, activeInfo.windowId);

        // Update tab activity in TabActivityTracker
        tabActivityTracker.activateTab(activeInfo);
    } catch (error) {
        console.error('Error in handleTabActivated:', error);
        logError('HANDLE_TAB_ACTIVATED', error, activeInfo);
    }
}

async function handleWindowRemoved(windowId: number): Promise<void> {
    try {
        console.log('Window removed:', windowId);

        // Remove all tabs from this window using TabManager
        tabManager.removeWindow(windowId);

        // Also remove from TabActivityTracker
        tabActivityTracker.removeWindow(windowId);

        const currentCount = await tabManager.getCurrentTabCount();
        console.log(`Updated tab count after window closure: ${currentCount}`);
    } catch (error) {
        console.error('Error in handleWindowRemoved:', error);
        logError('HANDLE_WINDOW_REMOVED', error, { windowId });
    }
}

// Utility functions to get manager instances (for testing and external access)
export function getTabManager(): TabManager {
    return tabManager;
}

export function getTabActivityTracker(): TabActivityTracker {
    return tabActivityTracker;
}

export function getTabSuggestionEngine(): TabSuggestionEngine {
    return tabSuggestionEngine;
}

export function getStorageManager(): StorageManager {
    return storageManager;
}

export function getAutoCloseManager(): AutoCloseManager {
    return autoCloseManager;
}

// Error logging utility
async function logError(context: string, error: any, metadata?: any): Promise<void> {
    try {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context,
            error: error.message || error.toString(),
            stack: error.stack,
            metadata
        };

        // Store error in local storage for debugging
        const { errorLogs = [] } = await chrome.storage.local.get('errorLogs');
        errorLogs.push(errorLog);

        // Keep only last 50 errors
        if (errorLogs.length > 50) {
            errorLogs.splice(0, errorLogs.length - 50);
        }

        await chrome.storage.local.set({ errorLogs });
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }
}

// Message handlers for UI interactions
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case 'createBackup':
                    await storageManager.createBackup();
                    sendResponse(true);
                    break;

                case 'restoreFromBackup':
                    const restored = await storageManager.restoreFromBackup();
                    sendResponse(restored);
                    break;

                case 'exportConfig':
                    const jsonData = await storageManager.exportConfig();
                    sendResponse(jsonData);
                    break;

                case 'importConfig':
                    const importResult = await storageManager.importConfig(message.data);
                    sendResponse(importResult);
                    break;

                case 'resetToDefaults':
                    await storageManager.resetToDefaults();
                    sendResponse(true);
                    break;

                case 'getStorageStats':
                    const stats = await storageManager.getStorageStats();
                    sendResponse(stats);
                    break;

                case 'getBackups':
                    const backups = await storageManager.getBackups();
                    sendResponse(backups);
                    break;

                case 'getSuggestedTabs':
                    try {
                        // Use TabSuggestionEngine to get intelligent tab suggestions
                        const criteria = {
                            maxSuggestions: message.maxSuggestions || 5,
                            minInactivityMinutes: message.minInactivityMinutes || 30,
                            includePinnedTabs: message.includePinnedTabs || false,
                            prioritizeMemoryUsage: message.prioritizeMemoryUsage !== false,
                            prioritizeLowProductivity: message.prioritizeLowProductivity !== false,
                            excludeWorkTabs: message.excludeWorkTabs !== false
                        };
                        
                        const scoredSuggestions = await tabSuggestionEngine.getSuggestions(criteria);
                        
                        // Format suggestions for UI display
                        const suggestions = scoredSuggestions.map(suggestion => ({
                            tabId: suggestion.tabId,
                            title: suggestion.title,
                            url: suggestion.url,
                            lastAccessed: suggestion.lastAccessed,
                            memoryUsage: suggestion.memoryUsage,
                            productivityScore: suggestion.productivityScore,
                            closureScore: suggestion.closureScore,
                            formattedLastAccessed: TabSuggestionEngine.formatTimeSinceLastAccess(suggestion.lastAccessed),
                            formattedMemoryUsage: TabSuggestionEngine.formatMemoryUsage(suggestion.memoryUsage),
                            category: suggestion.category,
                            isPinned: suggestion.isPinned
                        }));

                        sendResponse({ suggestions });
                    } catch (error) {
                        console.error('Error getting suggested tabs:', error);
                        sendResponse({ suggestions: [] });
                    }
                    break;

                case 'closeSuggestedTabs':
                    try {
                        if (message.tabIds && Array.isArray(message.tabIds)) {
                            await chrome.tabs.remove(message.tabIds);
                            sendResponse({ success: true, closed: message.tabIds.length });
                        } else {
                            sendResponse({ success: false, error: 'No tab IDs provided' });
                        }
                    } catch (error) {
                        console.error('Error closing suggested tabs:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'closeInactiveTabs':
                    try {
                        // Use TabActivityTracker to get inactive tabs based on actual usage data
                        const inactiveTabsData = tabActivityTracker.getInactiveTabs(message.thresholdMinutes);

                        // Get tab IDs to close
                        const tabsToClose = inactiveTabsData
                            .slice(0, message.maxTabs || 3) // Limit to specified number or default to 3
                            .map(tab => tab.tabId);

                        if (tabsToClose.length > 0) {
                            await chrome.tabs.remove(tabsToClose);
                            sendResponse({
                                success: true,
                                closed: tabsToClose.length,
                                tabsData: inactiveTabsData.slice(0, tabsToClose.length)
                            });
                        } else {
                            sendResponse({ success: false, message: 'No inactive tabs to close' });
                        }
                    } catch (error) {
                        console.error('Error closing inactive tabs:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'showNotification':
                    try {
                        console.log('Showing notification:', message);
                        // Create and show notification using Chrome's notifications API
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('icons/icon48.png'), // Use getURL for correct path resolution
                            title: message.title || 'TabGuard Pro',
                            message: message.message || 'Notification from TabGuard Pro',
                            priority: 1,
                            silent: message.silent === true
                        }, (notificationId) => {
                            if (chrome.runtime.lastError) {
                                console.error('Notification creation error:', chrome.runtime.lastError);
                                sendResponse({
                                    success: false,
                                    error: chrome.runtime.lastError.message
                                });
                            } else {
                                console.log('Notification created with ID:', notificationId);
                                sendResponse({ success: true, notificationId });
                            }
                        });
                    } catch (error) {
                        console.error('Error showing notification:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    return true; // Important: return true to indicate we'll send response asynchronously

                case 'updateConfig':
                    try {
                        if (message.config) {
                            // Get current config
                            const { userConfig } = await chrome.storage.sync.get('userConfig');
                            // Update with new values
                            const updatedConfig = { ...userConfig, ...message.config };
                            // Save back to storage
                            await chrome.storage.sync.set({ userConfig: updatedConfig });
                            // Update TabManager with new config
                            tabManager.updateConfig(updatedConfig);
                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'No config provided' });
                        }
                    } catch (error) {
                        console.error('Error updating config:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'getTabCount':
                    try {
                        const count = await tabManager.getCurrentTabCount();
                        sendResponse({ count });
                    } catch (error) {
                        console.error('Error getting tab count:', error);
                        sendResponse({ count: 0, error: String(error) });
                    }
                    break;

                case 'getTabActivitySummary':
                    try {
                        const summary = tabActivityTracker.getActivitySummary();
                        sendResponse({ summary });
                    } catch (error) {
                        console.error('Error getting tab activity summary:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'getTabActivityOptions':
                    try {
                        const options = tabActivityTracker.getOptions();
                        sendResponse({ options });
                    } catch (error) {
                        console.error('Error getting tab activity options:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'updateTabActivityOptions':
                    try {
                        if (message.options) {
                            tabActivityTracker.updateOptions(message.options);
                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'No options provided' });
                        }
                    } catch (error) {
                        console.error('Error updating tab activity options:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                // Auto-close functionality message handlers
                case 'getAutoCloseOptions':
                    try {
                        const options = autoCloseManager.getOptions();
                        sendResponse({ options });
                    } catch (error) {
                        console.error('Error getting auto-close options:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'updateAutoCloseOptions':
                    try {
                        if (message.options) {
                            autoCloseManager.updateOptions(message.options);
                            
                            // Also update user config in storage
                            const { userConfig } = await chrome.storage.sync.get('userConfig');
                            if (userConfig) {
                                const updatedConfig = { 
                                    ...userConfig, 
                                    autoCloseEnabled: message.options.enabled !== undefined ? message.options.enabled : userConfig.autoCloseEnabled,
                                    autoCloseDelay: message.options.inactivityThreshold !== undefined ? message.options.inactivityThreshold : userConfig.autoCloseDelay
                                };
                                await chrome.storage.sync.set({ userConfig: updatedConfig });
                                tabManager.updateConfig(updatedConfig);
                            }
                            
                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'No options provided' });
                        }
                    } catch (error) {
                        console.error('Error updating auto-close options:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                case 'getWhitelist':
                    try {
                        const whitelist = autoCloseManager.getWhitelist();
                        sendResponse({ whitelist });
                    } catch (error) {
                        console.error('Error getting whitelist:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'addToWhitelist':
                    try {
                        if (message.entry) {
                            const success = await autoCloseManager.addToWhitelist(message.entry);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'No whitelist entry provided' });
                        }
                    } catch (error) {
                        console.error('Error adding to whitelist:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                case 'removeFromWhitelist':
                    try {
                        if (message.type && message.value) {
                            const success = await autoCloseManager.removeFromWhitelist(message.type, message.value);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'Missing whitelist entry type or value' });
                        }
                    } catch (error) {
                        console.error('Error removing from whitelist:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                case 'getClosedTabs':
                    try {
                        const closedTabs = autoCloseManager.getClosedTabs();
                        sendResponse({ closedTabs });
                    } catch (error) {
                        console.error('Error getting closed tabs:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'undoLastClosure':
                    try {
                        const success = await autoCloseManager.undoLastClosure();
                        sendResponse({ success });
                    } catch (error) {
                        console.error('Error undoing last closure:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                case 'cancelPendingClosures':
                    try {
                        autoCloseManager.cancelPendingClosures();
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Error cancelling pending closures:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error(`Error handling message ${message.action}:`, error);
            sendResponse({ error: String(error) });
        }
    })();

    // Return true to indicate we will send a response asynchronously
    return true;
});

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeExtension,
        getAllTabsCount,
        handleTabCreated,
        handleTabRemoved,
        handleTabUpdated,
        handleTabActivated,
        handleWindowRemoved,
        getTabManager,
        getTabActivityTracker,
        getTabSuggestionEngine,
        getAutoCloseManager
    };
}