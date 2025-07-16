// Background service worker for TabGuard Pro
// Main entry point for tab management and extension coordination

console.log('TabGuard Pro background service worker loaded');

// Initialize extension on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('TabGuard Pro extension started');
    initializeExtension();
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
    console.log('TabGuard Pro extension installed/updated:', details.reason);
    initializeExtension();
});

// Basic tab event listeners
chrome.tabs.onCreated.addListener((tab) => {
    console.log('Tab created:', tab.id, tab.url);
    handleTabCreated(tab);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Tab removed:', tabId);
    handleTabRemoved(tabId, removeInfo);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        console.log('Tab updated:', tabId, tab.url);
        handleTabUpdated(tabId, changeInfo, tab);
    }
});

// Core initialization function
async function initializeExtension(): Promise<void> {
    try {
        // Set default configuration if not exists
        const config = await chrome.storage.sync.get('userConfig');
        if (!config.userConfig) {
            const defaultConfig = {
                tabLimit: 10,
                autoCloseEnabled: false,
                autoCloseDelay: 30,
                theme: 'auto',
                notificationsEnabled: true,
                rules: [],
                profiles: []
            };
            await chrome.storage.sync.set({ userConfig: defaultConfig });
            console.log('Default configuration set');
        }
    } catch (error) {
        console.error('Failed to initialize extension:', error);
    }
}

// Tab event handlers (placeholder implementations)
async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    // TODO: Implement tab limit enforcement
    console.log('Handling tab creation:', tab.id);
}

async function handleTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): Promise<void> {
    // TODO: Update tab count and cleanup
    console.log('Handling tab removal:', tabId);
}

async function handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    // TODO: Track tab activity and update metadata
    console.log('Handling tab update:', tabId);
}

// Functions are available globally in the service worker context