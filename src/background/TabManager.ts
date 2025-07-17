// TabManager class for tab limit enforcement and management
// Implements core tab limiting functionality with blocking mechanism

import { UserConfig, TabSuggestion } from '../shared/types';

export interface TabMetadata {
    id: number;
    url: string;
    title: string;
    windowId: number;
    createdAt: Date;
    lastAccessed: Date;
    isActive: boolean;
}

export interface TabLimitResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    message?: string;
}

export class TabManager {
    private tabMetadata = new Map<number, TabMetadata>();
    private currentTabCount = 0;
    private config: UserConfig | null = null;

    constructor() {
        this.loadConfiguration();
    }

    /**
     * Load user configuration from storage
     */
    private async loadConfiguration(): Promise<void> {
        try {
            const { userConfig } = await chrome.storage.sync.get('userConfig');
            this.config = userConfig || null;
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    /**
     * Get current tab count across all windows
     */
    async getCurrentTabCount(): Promise<number> {
        try {
            const allTabs = await chrome.tabs.query({});
            this.currentTabCount = allTabs.length;
            return this.currentTabCount;
        } catch (error) {
            console.error('Failed to get current tab count:', error);
            return this.currentTabCount;
        }
    }

    /**
     * Enforce tab limit - core enforcement logic
     * Returns whether a new tab should be allowed
     */
    async enforceTabLimit(limit?: number): Promise<TabLimitResult> {
        try {
            // Reload config to get latest settings
            await this.loadConfiguration();

            const effectiveLimit = limit || this.config?.tabLimit || 25;
            const currentCount = await this.getCurrentTabCount();

            const result: TabLimitResult = {
                allowed: currentCount < effectiveLimit,
                currentCount,
                limit: effectiveLimit
            };

            if (!result.allowed) {
                result.message = `Tab limit reached: ${currentCount}/${effectiveLimit} tabs open`;

                // Show notification if enabled
                if (this.config?.notificationsEnabled) {
                    await this.showLimitViolationNotification(currentCount, effectiveLimit);
                }

                // Block the new tab by closing the most recently created tab
                await this.blockNewTab();
            }

            return result;
        } catch (error) {
            console.error('Failed to enforce tab limit:', error);
            return {
                allowed: true, // Fail open to avoid breaking user experience
                currentCount: this.currentTabCount,
                limit: limit || 25,
                message: 'Error enforcing tab limit'
            };
        }
    }

    /**
     * Block new tab creation by closing the most recently created tab
     */
    private async blockNewTab(): Promise<void> {
        try {
            // Get all tabs and find the most recently created one
            const allTabs = await chrome.tabs.query({});

            if (allTabs.length === 0) return;

            // Sort by creation time (most recent first) based on tab ID as proxy
            // In Chrome, higher tab IDs are generally more recent
            const sortedTabs = allTabs.sort((a, b) => (b.id || 0) - (a.id || 0));
            const mostRecentTab = sortedTabs[0];

            if (mostRecentTab.id) {
                console.log(`Blocking new tab by closing tab ${mostRecentTab.id}: ${mostRecentTab.title}`);
                await chrome.tabs.remove(mostRecentTab.id);

                // Update our internal count
                this.currentTabCount = Math.max(0, this.currentTabCount - 1);
                this.tabMetadata.delete(mostRecentTab.id);
            }
        } catch (error) {
            console.error('Failed to block new tab:', error);
        }
    }

    /**
     * Show notification for tab limit violation
     */
    private async showLimitViolationNotification(currentCount: number, limit: number): Promise<void> {
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/icons/icon48.png',
                title: 'TabGuard Pro - Tab Limit Exceeded',
                message: `Tab limit exceeded! You have ${currentCount} tabs open (limit: ${limit}). The newest tab was automatically closed.`,
                priority: 2
            });
        } catch (error) {
            console.error('Failed to show limit violation notification:', error);
        }
    }

    /**
     * Add tab to tracking
     */
    addTab(tab: chrome.tabs.Tab): void {
        if (!tab.id) return;

        const metadata: TabMetadata = {
            id: tab.id,
            url: tab.url || '',
            title: tab.title || '',
            windowId: tab.windowId,
            createdAt: new Date(),
            lastAccessed: new Date(),
            isActive: tab.active || false
        };

        this.tabMetadata.set(tab.id, metadata);
        this.currentTabCount++;
    }

    /**
     * Remove tab from tracking
     */
    removeTab(tabId: number): void {
        if (this.tabMetadata.has(tabId)) {
            this.tabMetadata.delete(tabId);
            this.currentTabCount = Math.max(0, this.currentTabCount - 1);
        }
    }

    /**
     * Update tab metadata
     */
    updateTab(tabId: number, updates: Partial<TabMetadata>): void {
        const existing = this.tabMetadata.get(tabId);
        if (existing) {
            const updated = { ...existing, ...updates, lastAccessed: new Date() };
            this.tabMetadata.set(tabId, updated);
        }
    }

    /**
     * Mark tab as active and others in same window as inactive
     */
    setActiveTab(tabId: number, windowId: number): void {
        // Mark all tabs in window as inactive
        for (const [id, metadata] of this.tabMetadata.entries()) {
            if (metadata.windowId === windowId) {
                metadata.isActive = id === tabId;
                if (metadata.isActive) {
                    metadata.lastAccessed = new Date();
                }
                this.tabMetadata.set(id, metadata);
            }
        }
    }

    /**
     * Get suggested tabs to close based on inactivity
     */
    async getSuggestedTabsToClose(): Promise<TabSuggestion[]> {
        try {
            const suggestions: TabSuggestion[] = [];
            const now = new Date();

            for (const metadata of this.tabMetadata.values()) {
                if (!metadata.isActive) {
                    const inactiveMinutes = (now.getTime() - metadata.lastAccessed.getTime()) / (1000 * 60);

                    // Suggest tabs inactive for more than 30 minutes
                    if (inactiveMinutes > 30) {
                        suggestions.push({
                            tabId: metadata.id,
                            title: metadata.title,
                            url: metadata.url,
                            lastAccessed: metadata.lastAccessed,
                            memoryUsage: 0, // Will be implemented in future tasks
                            productivityScore: this.calculateProductivityScore(metadata.url)
                        });
                    }
                }
            }

            // Sort by last accessed time (oldest first)
            suggestions.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

            return suggestions;
        } catch (error) {
            console.error('Failed to get suggested tabs to close:', error);
            return [];
        }
    }

    /**
     * Calculate basic productivity score for a URL
     * Higher score = more productive, lower score = less productive
     */
    private calculateProductivityScore(url: string): number {
        // Basic scoring based on domain patterns
        const productiveDomains = ['github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so'];
        const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];
        const entertainmentDomains = ['youtube.com', 'netflix.com', 'twitch.tv'];

        const domain = new URL(url).hostname.toLowerCase();

        if (productiveDomains.some(d => domain.includes(d))) return 8;
        if (socialDomains.some(d => domain.includes(d))) return 2;
        if (entertainmentDomains.some(d => domain.includes(d))) return 1;

        return 5; // Neutral score for unknown domains
    }

    /**
     * Remove all tabs from a closed window
     */
    removeWindow(windowId: number): void {
        const tabsToRemove = Array.from(this.tabMetadata.entries())
            .filter(([_, metadata]) => metadata.windowId === windowId);

        for (const [tabId, _] of tabsToRemove) {
            this.tabMetadata.delete(tabId);
            this.currentTabCount = Math.max(0, this.currentTabCount - 1);
        }
    }

    /**
     * Initialize tab tracking from existing tabs
     */
    async initializeFromExistingTabs(): Promise<void> {
        try {
            const allTabs = await chrome.tabs.query({});
            this.tabMetadata.clear();
            this.currentTabCount = 0;

            for (const tab of allTabs) {
                if (tab.id) {
                    this.addTab(tab);
                }
            }

            console.log(`TabManager initialized with ${this.currentTabCount} tabs`);
        } catch (error) {
            console.error('Failed to initialize tab tracking:', error);
        }
    }

    /**
     * Get tab metadata for debugging/testing
     */
    getTabMetadata(): Map<number, TabMetadata> {
        return new Map(this.tabMetadata);
    }

    /**
     * Update configuration
     */
    updateConfig(config: UserConfig): void {
        this.config = config;
    }
}