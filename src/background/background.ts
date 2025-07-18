// Background service worker for TabGuard Pro
// Main entry point for tab management and extension coordination

import { TabManager } from './TabManager';
import { StorageManager } from '../shared/StorageManager';
import { TabActivityTracker } from './TabActivityTracker';
import { TabSuggestionEngine } from './TabSuggestionEngine';
import { AutoCloseManager } from './AutoCloseManager';
import { RuleEngine } from './RuleEngine';
import { FocusModeManager } from './FocusModeManager';
import { BrowsingAnalytics } from './BrowsingAnalytics';
import { RecommendationEngine } from './RecommendationEngine';

console.log('TabGuard Pro background service worker loaded');

// Initialize TabManager, TabActivityTracker, TabSuggestionEngine and StorageManager instances
const tabManager = new TabManager();
const tabActivityTracker = new TabActivityTracker();
const tabSuggestionEngine = new TabSuggestionEngine(tabActivityTracker);
const storageManager = new StorageManager();
const autoCloseManager = new AutoCloseManager(tabActivityTracker, tabSuggestionEngine);
const ruleEngine = new RuleEngine(tabActivityTracker);
const focusModeManager = new FocusModeManager(ruleEngine);
const browsingAnalytics = new BrowsingAnalytics(tabActivityTracker);
const recommendationEngine = new RecommendationEngine(tabActivityTracker, browsingAnalytics);

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

        // Initialize AutoCloseManager and RuleEngine with user configuration
        const { userConfig } = await chrome.storage.sync.get('userConfig');
        if (userConfig) {
            await autoCloseManager.initialize(userConfig);
            console.log('AutoCloseManager initialized successfully');

            // Initialize RuleEngine with rules from user config
            if (userConfig.rules && Array.isArray(userConfig.rules)) {
                ruleEngine.setRules(userConfig.rules);
                console.log(`RuleEngine initialized with ${userConfig.rules.length} rules`);
            }

            // Initialize FocusModeManager
            await focusModeManager.initialize();
            console.log('FocusModeManager initialized successfully');
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

        // Enforce tab limit using TabManager with RuleEngine integration
        const limitResult = await tabManager.enforceTabLimit(undefined, tab, ruleEngine);

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

export function getRuleEngine(): RuleEngine {
    return ruleEngine;
}

export function getFocusModeManager(): FocusModeManager {
    return focusModeManager;
}

export function getBrowsingAnalytics(): BrowsingAnalytics {
    return browsingAnalytics;
}

export function getRecommendationEngine(): RecommendationEngine {
    return recommendationEngine;
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

                // Rule Engine message handlers
                case 'getRules':
                    try {
                        const rules = ruleEngine.getRules();
                        sendResponse({ rules });
                    } catch (error) {
                        console.error('Error getting rules:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'setRules':
                    try {
                        if (message.rules && Array.isArray(message.rules)) {
                            ruleEngine.setRules(message.rules);

                            // Also update user config in storage
                            const { userConfig } = await chrome.storage.sync.get('userConfig');
                            if (userConfig) {
                                const updatedConfig = {
                                    ...userConfig,
                                    rules: message.rules
                                };
                                await chrome.storage.sync.set({ userConfig: updatedConfig });
                                tabManager.updateConfig(updatedConfig);
                            }

                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'No rules provided or invalid format' });
                        }
                    } catch (error) {
                        console.error('Error setting rules:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                // Browsing Analytics message handlers
                case 'getProductivityInsights':
                    try {
                        const period = message.period || 'today';
                        let insights;

                        if (period === 'today') {
                            insights = await browsingAnalytics.getTodayInsights();
                        } else if (period === 'week') {
                            insights = await browsingAnalytics.getWeekInsights();
                        } else if (period === 'month') {
                            // Get the first and last day of the current month
                            const now = new Date();
                            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                            insights = await browsingAnalytics.getDateRangeInsights(firstDay, lastDay);
                        } else if (message.startDate && message.endDate) {
                            insights = await browsingAnalytics.getDateRangeInsights(
                                new Date(message.startDate),
                                new Date(message.endDate)
                            );
                        } else {
                            insights = await browsingAnalytics.getTodayInsights();
                        }
                        
                        // Enhance insights with AI-powered recommendations
                        const recommendations = await recommendationEngine.getPersonalizedRecommendations(insights);
                        insights.recommendations = recommendations.map(rec => rec.description);
                        
                        // Include full recommendation data for advanced UI features
                        insights.fullRecommendations = recommendations;
                        
                        // Get optimal tab limit recommendation
                        const tabLimitRec = await recommendationEngine.getOptimalTabLimit(insights);
                        insights.tabLimitRecommendation = tabLimitRec;
                        
                        // Get focus time recommendations
                        const focusRecs = await recommendationEngine.getFocusTimeRecommendations(insights);
                        insights.focusRecommendations = focusRecs;
                        
                        // Get trend data for visualization
                        let trendData: { dates: string[], scores: number[] } = { dates: [], scores: [] };
                        
                        // For today, get hourly trend
                        if (period === 'today') {
                            const now = new Date();
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            // Create sample data if no hourly data available
                            const hours = [];
                            for (let i = 0; i <= now.getHours(); i++) {
                                const date = new Date(today);
                                date.setHours(i);
                                hours.push(date);
                            }
                            
                            trendData = {
                                dates: hours.map(d => d.toISOString()),
                                scores: hours.map(() => insights.productivityScore)
                            };
                        } 
                        // For week, get daily trend
                        else if (period === 'week') {
                            const now = new Date();
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
                            startOfWeek.setHours(0, 0, 0, 0);
                            
                            const days = [];
                            for (let i = 0; i <= 6; i++) {
                                const date = new Date(startOfWeek);
                                date.setDate(startOfWeek.getDate() + i);
                                if (date <= now) {
                                    days.push(date);
                                }
                            }
                            
                            trendData = {
                                dates: days.map(d => d.toISOString()),
                                scores: days.map(() => insights.productivityScore)
                            };
                        }
                        // For month, get weekly trend
                        else if (period === 'month') {
                            const now = new Date();
                            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                            
                            // Create a weekly trend
                            const weeks = [];
                            let currentWeekStart = new Date(startOfMonth);
                            while (currentWeekStart <= now) {
                                weeks.push(new Date(currentWeekStart));
                                currentWeekStart.setDate(currentWeekStart.getDate() + 7);
                            }
                            
                            trendData = {
                                dates: weeks.map(w => w.toISOString()),
                                scores: weeks.map(() => insights.productivityScore)
                            };
                        }
                        
                        insights.trendData = trendData;
                        
                        sendResponse({ insights, trendData });
                    } catch (error) {
                        console.error('Error getting productivity insights:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'getOptimalTabLimit':
                    try {
                        // Get current insights
                        const insights = await browsingAnalytics.getTodayInsights();
                        
                        // Get optimal tab limit recommendation
                        const tabLimitRec = await recommendationEngine.getOptimalTabLimit(insights);
                        
                        sendResponse({ recommendation: tabLimitRec });
                    } catch (error) {
                        console.error('Error getting optimal tab limit:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'getFocusTimeRecommendations':
                    try {
                        // Get current insights
                        const insights = await browsingAnalytics.getTodayInsights();
                        
                        // Get focus time recommendations
                        const focusRecs = await recommendationEngine.getFocusTimeRecommendations(insights);
                        
                        sendResponse({ recommendations: focusRecs });
                    } catch (error) {
                        console.error('Error getting focus time recommendations:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'getPersonalizedRecommendations':
                    try {
                        // Get current insights
                        const insights = await browsingAnalytics.getTodayInsights();
                        
                        // Get personalized recommendations
                        const recommendations = await recommendationEngine.getPersonalizedRecommendations(insights);
                        
                        sendResponse({ recommendations });
                    } catch (error) {
                        console.error('Error getting personalized recommendations:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'generateWeeklyReport':
                    try {
                        // Generate weekly report
                        const report = await recommendationEngine.generateWeeklyReport();
                        
                        sendResponse({ report });
                    } catch (error) {
                        console.error('Error generating weekly report:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;
                    
                case 'executeRecommendation':
                    try {
                        const recommendationType = message.recommendationType;
                        const recommendationAction = message.recommendationAction;
                        
                        if (!recommendationType || !recommendationAction) {
                            sendResponse({ success: false, error: 'Missing recommendation details' });
                            break;
                        }
                        
                        // Handle different recommendation types
                        switch (recommendationType) {
                            case 'tab_limit':
                                if (recommendationAction.type === 'set_limit' && recommendationAction.value) {
                                    // Update tab limit in user config
                                    const { userConfig } = await chrome.storage.sync.get('userConfig');
                                    if (userConfig) {
                                        const updatedConfig = {
                                            ...userConfig,
                                            tabLimit: recommendationAction.value
                                        };
                                        await chrome.storage.sync.set({ userConfig: updatedConfig });
                                        tabManager.updateConfig(updatedConfig);
                                        
                                        // Show notification
                                        chrome.notifications.create({
                                            type: 'basic',
                                            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                            title: 'Tab Limit Updated',
                                            message: `Tab limit has been set to ${recommendationAction.value}`,
                                            priority: 1
                                        });
                                        
                                        sendResponse({ success: true });
                                    } else {
                                        sendResponse({ success: false, error: 'User config not found' });
                                    }
                                }
                                break;
                                
                            case 'focus_time':
                                if (recommendationAction.type === 'start_focus' && recommendationAction.duration) {
                                    // Start focus mode
                                    await focusModeManager.startFocusMode(recommendationAction.duration);
                                    
                                    // Show notification
                                    chrome.notifications.create({
                                        type: 'basic',
                                        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                        title: 'Focus Mode Started',
                                        message: `Focus mode activated for ${recommendationAction.duration} minutes`,
                                        priority: 1
                                    });
                                    
                                    sendResponse({ success: true });
                                }
                                break;
                                
                            case 'break_reminder':
                                if (recommendationAction.type === 'take_break' && recommendationAction.duration) {
                                    // Schedule a break reminder
                                    const breakDuration = recommendationAction.duration;
                                    
                                    // Show notification
                                    chrome.notifications.create({
                                        type: 'basic',
                                        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                        title: 'Break Time',
                                        message: `Time for a ${breakDuration}-minute break to refresh your focus`,
                                        priority: 1
                                    });
                                    
                                    // Schedule end of break notification
                                    setTimeout(() => {
                                        chrome.notifications.create({
                                            type: 'basic',
                                            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                            title: 'Break Ended',
                                            message: 'Your break time is over. Ready to get back to work?',
                                            priority: 1
                                        });
                                    }, breakDuration * 60 * 1000);
                                    
                                    sendResponse({ success: true });
                                }
                                break;
                                
                            case 'close_tabs':
                                if (recommendationAction.type === 'close_tabs') {
                                    // Get inactive tabs
                                    const inactiveTabs = tabActivityTracker.getInactiveTabs(30); // 30 minutes threshold
                                    
                                    if (inactiveTabs.length > 0) {
                                        // Get tab IDs to close (max 5)
                                        const tabsToClose = inactiveTabs
                                            .slice(0, 5)
                                            .map(tab => tab.tabId);
                                            
                                        // Close tabs
                                        await chrome.tabs.remove(tabsToClose);
                                        
                                        // Show notification
                                        chrome.notifications.create({
                                            type: 'basic',
                                            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                            title: 'Tabs Closed',
                                            message: `Closed ${tabsToClose.length} inactive tabs to improve performance`,
                                            priority: 1
                                        });
                                        
                                        sendResponse({ success: true, closed: tabsToClose.length });
                                    } else {
                                        sendResponse({ success: false, message: 'No inactive tabs to close' });
                                    }
                                }
                                break;
                                
                            case 'category_limit':
                                if (recommendationAction.type === 'set_category_limit' && recommendationAction.value) {
                                    const category = recommendationAction.value;
                                    
                                    // Create a rule for this category
                                    const { userConfig } = await chrome.storage.sync.get('userConfig');
                                    if (userConfig && userConfig.rules) {
                                        // Create a new rule
                                        const newRule = {
                                            id: `auto-${Date.now()}`,
                                            name: `Auto-generated ${category} limit`,
                                            condition: {
                                                type: 'category',
                                                operator: 'equals',
                                                value: category
                                            },
                                            action: {
                                                type: 'limit_tabs',
                                                value: 3 // Default to 3 tabs for this category
                                            },
                                            priority: 10,
                                            enabled: true
                                        };
                                        
                                        // Add the rule
                                        const updatedRules = [...userConfig.rules, newRule];
                                        const updatedConfig = {
                                            ...userConfig,
                                            rules: updatedRules
                                        };
                                        
                                        // Save to storage
                                        await chrome.storage.sync.set({ userConfig: updatedConfig });
                                        
                                        // Update rule engine
                                        ruleEngine.setRules(updatedRules);
                                        
                                        // Show notification
                                        chrome.notifications.create({
                                            type: 'basic',
                                            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                                            title: 'Category Limit Created',
                                            message: `Created a limit for ${category} websites`,
                                            priority: 1
                                        });
                                        
                                        sendResponse({ success: true });
                                    } else {
                                        sendResponse({ success: false, error: 'User config not found' });
                                    }
                                }
                                break;
                                
                            default:
                                sendResponse({ success: false, error: 'Unknown recommendation type' });
                        }
                    } catch (error) {
                        console.error('Error executing recommendation:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;
                    
                case 'exportProductivityReport':
                    try {
                        const period = message.period || 'week';
                        
                        // Get insights based on period
                        let insights;
                        let reportTitle;
                        let dateRange;
                        
                        if (period === 'today') {
                            insights = await browsingAnalytics.getTodayInsights();
                            reportTitle = 'Daily Productivity Report';
                            const today = new Date();
                            dateRange = today.toLocaleDateString();
                        } else if (period === 'week') {
                            insights = await browsingAnalytics.getWeekInsights();
                            reportTitle = 'Weekly Productivity Report';
                            const now = new Date();
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
                            const endOfWeek = new Date(startOfWeek);
                            endOfWeek.setDate(startOfWeek.getDate() + 6);
                            dateRange = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
                        } else if (period === 'month') {
                            const now = new Date();
                            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                            insights = await browsingAnalytics.getDateRangeInsights(firstDay, lastDay);
                            reportTitle = 'Monthly Productivity Report';
                            dateRange = `${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`;
                        }
                        
                        if (!insights) {
                            throw new Error('No insights data available for report');
                        }
                        
                        // Create report content
                        const reportContent = {
                            title: reportTitle,
                            generatedAt: new Date().toLocaleString(),
                            dateRange,
                            productivityScore: insights.productivityScore,
                            focusMetrics: insights.focusMetrics,
                            categoryBreakdown: insights.categoryBreakdown,
                            recommendations: insights.recommendations,
                            trendData: insights.trendData
                        };
                        
                        // Create a downloadable report
                        const reportBlob = new Blob(
                            [JSON.stringify(reportContent, null, 2)], 
                            { type: 'application/json' }
                        );
                        
                        // Create download URL
                        const url = URL.createObjectURL(reportBlob);
                        
                        // Create and trigger download
                        const filename = `tabguard-${period}-report-${new Date().toISOString().split('T')[0]}.json`;
                        
                        await chrome.downloads.download({
                            url,
                            filename,
                            saveAs: true
                        });
                        
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Error exporting productivity report:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'getProductivityTrend':
                    try {
                        const period = message.period || 'week';
                        let trendData: { dates: string[], scores: number[] } = { dates: [], scores: [] };

                        // For today, get hourly trend
                        if (period === 'today') {
                            const now = new Date();
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            // Create sample data if no hourly data available
                            const hours = [];
                            for (let i = 0; i <= now.getHours(); i++) {
                                const date = new Date(today);
                                date.setHours(i);
                                hours.push(date);
                            }
                            
                            // Use current productivity score for all hours as placeholder
                            const insights = await browsingAnalytics.getTodayInsights();
                            trendData = {
                                dates: hours.map(d => d.toISOString()),
                                scores: hours.map(() => insights.productivityScore)
                            };
                        } 
                        // For week, get daily trend
                        else if (period === 'week') {
                            const now = new Date();
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
                            startOfWeek.setHours(0, 0, 0, 0);
                            
                            const days = [];
                            for (let i = 0; i <= 6; i++) {
                                const date = new Date(startOfWeek);
                                date.setDate(startOfWeek.getDate() + i);
                                if (date <= now) {
                                    days.push(date);
                                }
                            }
                            
                            // Use current weekly insights for all days as placeholder
                            const insights = await browsingAnalytics.getWeekInsights();
                            trendData = {
                                dates: days.map(d => d.toISOString()),
                                scores: days.map(() => insights.productivityScore)
                            };
                        }
                        // For month, get weekly trend
                        else if (period === 'month') {
                            const now = new Date();
                            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                            
                            // Create a weekly trend
                            const weeks = [];
                            let currentWeekStart = new Date(startOfMonth);
                            while (currentWeekStart <= now) {
                                weeks.push(new Date(currentWeekStart));
                                currentWeekStart.setDate(currentWeekStart.getDate() + 7);
                            }
                            
                            // Use monthly insights for all weeks as placeholder
                            const insights = await browsingAnalytics.getDateRangeInsights(
                                startOfMonth, 
                                new Date(now.getFullYear(), now.getMonth() + 1, 0)
                            );
                            trendData = {
                                dates: weeks.map(w => w.toISOString()),
                                scores: weeks.map(() => insights.productivityScore)
                            };
                        }

                        sendResponse({ trendData });
                    } catch (error) {
                        console.error('Error getting productivity trend:', error);
                        sendResponse({
                            error: String(error),
                            trendData: { dates: [], scores: [] }
                        });
                    }
                    break;
                case 'getCategoryDetails':
                    try {
                        const categoryDetails = browsingAnalytics.getCategoryDetails();
                        sendResponse({ categoryDetails });
                    } catch (error) {
                        console.error('Error getting category details:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'updateCategoryDetails':
                    try {
                        if (message.categoryDetails) {
                            browsingAnalytics.updateCategoryDetails(message.categoryDetails);
                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'No category details provided' });
                        }
                    } catch (error) {
                        console.error('Error updating category details:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'categorizeWebsite':
                    try {
                        if (message.url) {
                            const category = browsingAnalytics.categorizeWebsite(message.url);
                            sendResponse({ category });
                        } else {
                            sendResponse({ success: false, error: 'No URL provided' });
                        }
                    } catch (error) {
                        console.error('Error categorizing website:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'analyzeBrowsingData':
                    try {
                        await browsingAnalytics.analyzeBrowsingData();
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Error analyzing browsing data:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'evaluateRulesForTab':
                    try {
                        if (message.tabId) {
                            const tab = await chrome.tabs.get(message.tabId);
                            const tabCount = await tabManager.getCurrentTabCount();
                            const context = await ruleEngine.createContextFromTab(tab, tabCount);
                            const results = ruleEngine.evaluateRules(context);
                            const resolvedActions = ruleEngine.resolveConflicts(results);

                            sendResponse({
                                results,
                                resolvedActions,
                                conflicts: ruleEngine.getConflicts(),
                                context
                            });
                        } else {
                            sendResponse({ success: false, error: 'No tab ID provided' });
                        }
                    } catch (error) {
                        console.error('Error evaluating rules for tab:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                // Focus Mode message handlers
                case 'getFocusModeSettings':
                    try {
                        const settings = focusModeManager.getSettings();
                        sendResponse({ settings });
                    } catch (error) {
                        console.error('Error getting focus mode settings:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'updateFocusModeSettings':
                    try {
                        if (message.settings) {
                            const success = await focusModeManager.updateSettings(message.settings);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'No settings provided' });
                        }
                    } catch (error) {
                        console.error('Error updating focus mode settings:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'startFocusMode':
                    try {
                        const success = await focusModeManager.startFocusMode(
                            message.duration,
                            message.settings
                        );
                        sendResponse({ success });
                    } catch (error) {
                        console.error('Error starting focus mode:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'stopFocusMode':
                    try {
                        const success = await focusModeManager.stopFocusMode();
                        sendResponse({ success });
                    } catch (error) {
                        console.error('Error stopping focus mode:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'isFocusModeActive':
                    try {
                        const active = focusModeManager.isFocusModeActive();
                        sendResponse({ active });
                    } catch (error) {
                        console.error('Error checking focus mode status:', error);
                        sendResponse({ active: false, error: String(error) });
                    }
                    break;

                case 'grantTemporaryAccess':
                    try {
                        if (message.domain) {
                            const success = await focusModeManager.grantTemporaryAccess(message.domain);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'No domain provided' });
                        }
                    } catch (error) {
                        console.error('Error granting temporary access:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'getScheduledSessions':
                    try {
                        const sessions = focusModeManager.getScheduledSessions();
                        sendResponse({ sessions });
                    } catch (error) {
                        console.error('Error getting scheduled sessions:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'addScheduledSession':
                    try {
                        if (message.session) {
                            const id = await focusModeManager.addScheduledSession(message.session);
                            sendResponse({ success: true, id });
                        } else {
                            sendResponse({ success: false, error: 'No session provided' });
                        }
                    } catch (error) {
                        console.error('Error adding scheduled session:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'updateScheduledSession':
                    try {
                        if (message.id && message.updates) {
                            const success = await focusModeManager.updateScheduledSession(message.id, message.updates);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'Missing session ID or updates' });
                        }
                    } catch (error) {
                        console.error('Error updating scheduled session:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'deleteScheduledSession':
                    try {
                        if (message.id) {
                            const success = await focusModeManager.deleteScheduledSession(message.id);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'No session ID provided' });
                        }
                    } catch (error) {
                        console.error('Error deleting scheduled session:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'getTimeBasedRules':
                    try {
                        const rules = focusModeManager.getTimeBasedRules();
                        sendResponse({ rules });
                    } catch (error) {
                        console.error('Error getting time-based rules:', error);
                        sendResponse({ error: String(error) });
                    }
                    break;

                case 'addTimeBasedRule':
                    try {
                        if (message.rule) {
                            const id = await focusModeManager.addTimeBasedRule(message.rule);
                            sendResponse({ success: true, id });
                        } else {
                            sendResponse({ success: false, error: 'No rule provided' });
                        }
                    } catch (error) {
                        console.error('Error adding time-based rule:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'updateTimeBasedRule':
                    try {
                        if (message.id && message.updates) {
                            const success = await focusModeManager.updateTimeBasedRule(message.id, message.updates);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'Missing rule ID or updates' });
                        }
                    } catch (error) {
                        console.error('Error updating time-based rule:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'deleteTimeBasedRule':
                    try {
                        if (message.id) {
                            const success = await focusModeManager.deleteTimeBasedRule(message.id);
                            sendResponse({ success });
                        } else {
                            sendResponse({ success: false, error: 'No rule ID provided' });
                        }
                    } catch (error) {
                        console.error('Error deleting time-based rule:', error);
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'getTabLimitForDomain':
                    try {
                        if (message.url) {
                            let domain = '';
                            try {
                                if (message.url.startsWith('http')) {
                                    domain = new URL(message.url).hostname;
                                }
                            } catch (urlError) {
                                console.error('Error parsing URL:', urlError);
                            }

                            const tabCount = await tabManager.getCurrentTabCount();
                            const context = {
                                url: message.url,
                                domain,
                                tabId: -1,
                                windowId: -1,
                                tabCount,
                                currentTime: new Date(),
                                category: RuleEngine.categorizeUrl(message.url),
                                isActive: true
                            };

                            const limit = ruleEngine.getTabLimitForContext(context, message.defaultLimit || 25);
                            sendResponse({ limit, domain, category: context.category });
                        } else {
                            sendResponse({ success: false, error: 'No URL provided' });
                        }
                    } catch (error) {
                        console.error('Error getting tab limit for domain:', error);
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