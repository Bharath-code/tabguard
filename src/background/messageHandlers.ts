import { TabManager } from './TabManager';
import { StorageManager } from '../shared/StorageManager';
import { TabActivityTracker } from './TabActivityTracker';
import { TabSuggestionEngine } from './TabSuggestionEngine';
import { AutoCloseManager } from './AutoCloseManager';
import { RuleEngine } from './RuleEngine';
import { FocusModeManager } from './FocusModeManager';
import { BrowsingAnalytics } from './BrowsingAnalytics';
import { RecommendationEngine } from './RecommendationEngine';
import { SubscriptionManager } from './SubscriptionManager';

/**
 * Register message handlers for the extension
 * 
 * @param tabManager TabManager instance
 * @param tabActivityTracker TabActivityTracker instance
 * @param tabSuggestionEngine TabSuggestionEngine instance
 * @param storageManager StorageManager instance
 * @param autoCloseManager AutoCloseManager instance
 * @param ruleEngine RuleEngine instance
 * @param focusModeManager FocusModeManager instance
 * @param browsingAnalytics BrowsingAnalytics instance
 * @param recommendationEngine RecommendationEngine instance
 * @param subscriptionManager SubscriptionManager instance
 */
export function registerMessageHandlers(
    tabManager: TabManager,
    tabActivityTracker: TabActivityTracker,
    tabSuggestionEngine: TabSuggestionEngine,
    storageManager: StorageManager,
    autoCloseManager: AutoCloseManager,
    ruleEngine: RuleEngine,
    focusModeManager: FocusModeManager,
    browsingAnalytics: BrowsingAnalytics,
    recommendationEngine: RecommendationEngine,
    subscriptionManager: SubscriptionManager
): void {
    // Message handlers for UI interactions
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        (async () => {
            try {
                switch (message.action) {
                    // Storage Manager message handlers
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

                    // Tab Suggestion Engine message handlers
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

                    // Tab Management message handlers
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

                    // Notification message handlers
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

                    // Config message handlers
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

                    // Tab Manager message handlers
                    case 'getTabCount':
                        try {
                            const count = await tabManager.getCurrentTabCount();
                            sendResponse({ count });
                        } catch (error) {
                            console.error('Error getting tab count:', error);
                            sendResponse({ count: 0, error: String(error) });
                        }
                        break;

                    // Tab Activity Tracker message handlers
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

                    // Subscription Manager message handlers
                    case 'getCurrentPlan':
                        try {
                            const plan = await subscriptionManager.getCurrentPlan();
                            sendResponse({ plan });
                        } catch (error) {
                            console.error('Error getting current plan:', error);
                            sendResponse({ error: String(error) });
                        }
                        break;
                        
                    case 'hasFeatureAccess':
                        try {
                            if (message.featureId) {
                                const hasAccess = await subscriptionManager.hasFeatureAccess(message.featureId);
                                sendResponse({ hasAccess });
                            } else {
                                sendResponse({ hasAccess: false, error: 'No feature ID provided' });
                            }
                        } catch (error) {
                            console.error('Error checking feature access:', error);
                            sendResponse({ hasAccess: false, error: String(error) });
                        }
                        break;
                        
                    case 'getAvailableFeatures':
                        try {
                            const features = await subscriptionManager.getAvailableFeatures();
                            sendResponse({ features });
                        } catch (error) {
                            console.error('Error getting available features:', error);
                            sendResponse({ error: String(error) });
                        }
                        break;
                        
                    case 'getSubscriptionState':
                        try {
                            const state = subscriptionManager.getSubscriptionState();
                            sendResponse({ state });
                        } catch (error) {
                            console.error('Error getting subscription state:', error);
                            sendResponse({ error: String(error) });
                        }
                        break;
                        
                    case 'getAvailablePlans':
                        try {
                            const plans = subscriptionManager.getAvailablePlans();
                            sendResponse({ plans });
                        } catch (error) {
                            console.error('Error getting available plans:', error);
                            sendResponse({ error: String(error) });
                        }
                        break;

                    // DoDo Payment Integration message handlers
                    case 'createCheckoutSession':
                        try {
                            if (message.planId) {
                                const checkoutSession = await subscriptionManager.createCheckoutSession(
                                    message.planId,
                                    message.customerEmail
                                );
                                
                                if (checkoutSession) {
                                    sendResponse({ checkoutSession });
                                } else {
                                    sendResponse({ error: 'Failed to create checkout session' });
                                }
                            } else {
                                sendResponse({ error: 'No plan ID provided' });
                            }
                        } catch (error) {
                            console.error('Error creating checkout session:', error);
                            sendResponse({ error: String(error) });
                        }
                        break;
                        
                    case 'processPaymentSuccess':
                        try {
                            if (message.sessionId) {
                                const success = await subscriptionManager.processPaymentSuccess(message.sessionId);
                                sendResponse({ success });
                            } else {
                                sendResponse({ success: false, error: 'No session ID provided' });
                            }
                        } catch (error) {
                            console.error('Error processing payment success:', error);
                            sendResponse({ success: false, error: String(error) });
                        }
                        break;
                        
                    case 'processPaymentFailure':
                        try {
                            if (message.sessionId) {
                                await subscriptionManager.processPaymentFailure(message.sessionId, message.errorCode);
                                sendResponse({ success: true });
                            } else {
                                sendResponse({ success: false, error: 'No session ID provided' });
                            }
                        } catch (error) {
                            console.error('Error processing payment failure:', error);
                            sendResponse({ success: false, error: String(error) });
                        }
                        break;
                        
                    case 'cancelSubscription':
                        try {
                            const success = await subscriptionManager.cancelSubscription(message.cancelImmediately || false);
                            sendResponse({ success });
                        } catch (error) {
                            console.error('Error cancelling subscription:', error);
                            sendResponse({ success: false, error: String(error) });
                        }
                        break;
                        
                    case 'changeSubscriptionPlan':
                        try {
                            if (message.planId) {
                                const success = await subscriptionManager.changeSubscriptionPlan(message.planId);
                                sendResponse({ success });
                            } else {
                                sendResponse({ success: false, error: 'No plan ID provided' });
                            }
                        } catch (error) {
                            console.error('Error changing subscription plan:', error);
                            sendResponse({ success: false, error: String(error) });
                        }
                        break;
                        
                    case 'upgradeSubscription':
                        try {
                            if (message.planId) {
                                const success = await subscriptionManager.upgradeSubscription(message.planId);
                                sendResponse({ success });
                            } else {
                                sendResponse({ success: false, error: 'No plan ID provided' });
                            }
                        } catch (error) {
                            console.error('Error upgrading subscription:', error);
                            sendResponse({ success: false, error: String(error) });
                        }
                        break;

                    default:
                        console.warn('Unknown action:', message.action);
                        sendResponse({ error: `Unknown action: ${message.action}` });
                }
            } catch (error) {
                console.error('Error handling message:', error);
                sendResponse({ error: String(error) });
            }
        })().catch(error => {
            console.error('Unhandled promise rejection in message handler:', error);
            sendResponse({ error: String(error) });
        });

        return true; // Required to use sendResponse asynchronously
    });
}