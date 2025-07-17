// Background service worker for TabGuard Pro
// Main entry point for tab management and extension coordination

import { UserConfig } from '../shared/types';
import { TabManager } from './TabManager';
import { StorageManager } from '../shared/StorageManager';

console.log('TabGuard Pro background service worker loaded');

// Initialize TabManager and StorageManager instances
const tabManager = new TabManager();
const storageManager = new StorageManager();

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

        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize extension:', error);
        logError('INITIALIZATION', error);
    }
}

// Initialize tab tracking using TabManager
async function initializeTabTracking(): Promise<void> {
    try {
        await tabManager.initializeFromExistingTabs();
        const currentCount = await tabManager.getCurrentTabCount();
        console.log(`Initialized tab tracking: ${currentCount} tabs`);
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

export function getStorageManager(): StorageManager {
    return storageManager;
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
                        // Get tabs that might be good candidates for closing
                        const allTabs = await chrome.tabs.query({});
                        
                        // Simple algorithm: suggest tabs that haven't been accessed recently
                        // In a real implementation, this would use more sophisticated metrics
                        const suggestions = allTabs
                            .filter(tab => tab.id && tab.url && !tab.active)
                            .slice(0, 5)  // Limit to 5 suggestions
                            .map(tab => ({
                                tabId: tab.id as number,
                                title: tab.title || 'Untitled',
                                url: tab.url || '',
                                lastAccessed: new Date(),
                                memoryUsage: Math.floor(Math.random() * 100), // Mock data
                                productivityScore: Math.random() * 10 // Mock data
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
                        // Get all tabs
                        const tabs = await chrome.tabs.query({});
                        
                        // Filter for inactive tabs (not currently active)
                        const inactiveTabs = tabs.filter(tab => !tab.active && tab.id);
                        
                        // In a real implementation, we would check last access time
                        // For now, just close a subset of inactive tabs
                        const tabsToClose = inactiveTabs
                            .slice(0, Math.min(3, inactiveTabs.length))
                            .map(tab => tab.id as number);
                        
                        if (tabsToClose.length > 0) {
                            await chrome.tabs.remove(tabsToClose);
                            sendResponse({ success: true, closed: tabsToClose.length });
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
                    break;
                
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
        getTabManager
    };
}