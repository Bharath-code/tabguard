/**
 * TabActivityTracker for TabGuard Pro
 * 
 * Monitors tab usage patterns, tracks activity metrics, and provides data
 * for intelligent tab management features.
 * 
 * Implements requirements:
 * - 2.1: Track least active tabs for closure suggestions
 * - 2.4: Mark tabs inactive for more than 30 minutes as closure candidates
 * - 9.1: Privacy-compliant data collection
 */

import { WebsiteCategory } from '../shared/types';

export interface TabActivityData {
  tabId: number;
  url: string;
  title: string;
  domain: string;
  firstAccessed: Date;
  lastAccessed: Date;
  totalActiveTime: number; // milliseconds
  activationCount: number;
  memoryUsage: number; // in KB
  category: WebsiteCategory;
  isActive: boolean;
  windowId: number;
}

export interface TabActivityOptions {
  // How often to update memory usage data (in milliseconds)
  memoryUpdateInterval: number;
  
  // How long a tab must be inactive to be considered a closure candidate (in minutes)
  inactivityThreshold: number;
  
  // Whether to collect detailed browsing data
  collectDetailedData: boolean;
  
  // Whether to anonymize URLs for privacy
  anonymizeUrls: boolean;
}

export interface TabActivitySummary {
  totalTabs: number;
  activeTabs: number;
  inactiveTabs: number;
  oldestTab: TabActivityData | null;
  newestTab: TabActivityData | null;
  mostActiveTab: TabActivityData | null;
  leastActiveTab: TabActivityData | null;
  averageTabAge: number; // milliseconds
  averageActiveTime: number; // milliseconds
  totalMemoryUsage: number; // KB
}

export class TabActivityTracker {
  private tabActivities = new Map<number, TabActivityData>();
  private activeTabsByWindow = new Map<number, number>();
  private memoryUpdateIntervalId: number | null = null;
  private lastActiveTime = new Map<number, number>(); // Maps tabId to timestamp when activity started
  
  private options: TabActivityOptions = {
    memoryUpdateInterval: 60000, // 1 minute
    inactivityThreshold: 30, // 30 minutes
    collectDetailedData: false, // Default to privacy-focused mode
    anonymizeUrls: true // Default to anonymizing URLs
  };

  constructor(options?: Partial<TabActivityOptions>) {
    // Apply custom options
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Start memory usage tracking
    this.startMemoryTracking();
  }

  /**
   * Initialize tracker with existing tabs
   */
  async initializeFromExistingTabs(): Promise<void> {
    try {
      const allTabs = await chrome.tabs.query({});
      this.tabActivities.clear();
      
      for (const tab of allTabs) {
        if (tab.id) {
          this.trackTab(tab);
          
          // Mark active tabs
          if (tab.active && tab.windowId) {
            this.activeTabsByWindow.set(tab.windowId, tab.id);
            this.startTrackingActiveTime(tab.id);
          }
        }
      }
      
      console.log(`TabActivityTracker initialized with ${this.tabActivities.size} tabs`);
    } catch (error) {
      console.error('Failed to initialize tab activity tracking:', error);
    }
  }

  /**
   * Track a new tab
   */
  trackTab(tab: chrome.tabs.Tab): void {
    if (!tab.id) return;
    
    const now = new Date();
    const url = this.sanitizeUrl(tab.url || '');
    const domain = this.extractDomain(url);
    
    const activityData: TabActivityData = {
      tabId: tab.id,
      url: url,
      title: this.sanitizeTitle(tab.title || ''),
      domain: domain,
      firstAccessed: now,
      lastAccessed: now,
      totalActiveTime: 0,
      activationCount: 0,
      memoryUsage: 0,
      category: this.categorizeWebsite(domain),
      isActive: tab.active || false,
      windowId: tab.windowId || 0
    };
    
    this.tabActivities.set(tab.id, activityData);
    
    // If tab is active, start tracking active time
    if (tab.active) {
      this.startTrackingActiveTime(tab.id);
    }
  }

  /**
   * Update tab data when tab is updated
   */
  updateTab(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab): void {
    const existingData = this.tabActivities.get(tabId);
    if (!existingData) return;
    
    const updates: Partial<TabActivityData> = {};
    
    // Update URL and domain if changed
    if (changeInfo.url) {
      const sanitizedUrl = this.sanitizeUrl(changeInfo.url);
      const domain = this.extractDomain(sanitizedUrl);
      
      updates.url = sanitizedUrl;
      updates.domain = domain;
      updates.category = this.categorizeWebsite(domain);
    }
    
    // Update title if changed
    if (changeInfo.title) {
      updates.title = this.sanitizeTitle(changeInfo.title);
    }
    
    // Apply updates
    if (Object.keys(updates).length > 0) {
      this.tabActivities.set(tabId, { ...existingData, ...updates });
    }
  }

  /**
   * Handle tab activation (user switched to this tab)
   */
  activateTab(activeInfo: chrome.tabs.TabActiveInfo): void {
    const { tabId, windowId } = activeInfo;
    
    // Update active tab for this window
    const previousActiveTabId = this.activeTabsByWindow.get(windowId);
    this.activeTabsByWindow.set(windowId, tabId);
    
    // Stop tracking active time for previously active tab
    if (previousActiveTabId) {
      this.stopTrackingActiveTime(previousActiveTabId);
    }
    
    // Start tracking active time for newly active tab
    this.startTrackingActiveTime(tabId);
    
    // Update tab activity data
    const tabData = this.tabActivities.get(tabId);
    if (tabData) {
      const now = new Date();
      
      // Update tab data
      tabData.lastAccessed = now;
      tabData.activationCount += 1;
      tabData.isActive = true;
      
      this.tabActivities.set(tabId, tabData);
      
      // Mark all other tabs in this window as inactive
      for (const [id, data] of this.tabActivities.entries()) {
        if (id !== tabId && data.windowId === windowId) {
          data.isActive = false;
          this.tabActivities.set(id, data);
        }
      }
    }
  }

  /**
   * Remove tab from tracking when closed
   */
  removeTab(tabId: number): void {
    // Stop tracking active time if this was an active tab
    this.stopTrackingActiveTime(tabId);
    
    // Remove from activities map
    this.tabActivities.delete(tabId);
    
    // Remove from active tabs if present
    for (const [windowId, activeTabId] of this.activeTabsByWindow.entries()) {
      if (activeTabId === tabId) {
        this.activeTabsByWindow.delete(windowId);
      }
    }
  }

  /**
   * Remove all tabs from a closed window
   */
  removeWindow(windowId: number): void {
    // Find all tabs in this window
    const tabsToRemove = Array.from(this.tabActivities.values())
      .filter(data => data.windowId === windowId)
      .map(data => data.tabId);
    
    // Remove each tab
    for (const tabId of tabsToRemove) {
      this.removeTab(tabId);
    }
    
    // Remove window from active tabs tracking
    this.activeTabsByWindow.delete(windowId);
  }

  /**
   * Get tabs that are candidates for closure based on inactivity
   */
  getInactiveTabs(thresholdMinutes?: number): TabActivityData[] {
    const threshold = thresholdMinutes || this.options.inactivityThreshold;
    const now = new Date();
    const inactiveThreshold = threshold * 60 * 1000; // Convert to milliseconds
    
    return Array.from(this.tabActivities.values())
      .filter(data => {
        // Skip active tabs
        if (data.isActive) return false;
        
        // Check if tab has been inactive for longer than threshold
        const inactiveTime = now.getTime() - data.lastAccessed.getTime();
        return inactiveTime >= inactiveThreshold;
      })
      .sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()); // Oldest first
  }
  
  /**
   * Get activity data for a specific tab
   * @param tabId The ID of the tab to get activity for
   * @returns The tab activity data or undefined if not found
   */
  getTabActivity(tabId: number): TabActivityData | undefined {
    return this.tabActivities.get(tabId);
  }

  /**
   * Get summary of tab activity
   */
  getActivitySummary(): TabActivitySummary {
    const now = new Date();
    const tabs = Array.from(this.tabActivities.values());
    
    // Count active and inactive tabs
    const activeTabs = tabs.filter(tab => tab.isActive).length;
    
    // Find oldest and newest tabs
    let oldestTab: TabActivityData | null = null;
    let newestTab: TabActivityData | null = null;
    let mostActiveTab: TabActivityData | null = null;
    let leastActiveTab: TabActivityData | null = null;
    
    let totalAge = 0;
    let totalActiveTime = 0;
    let totalMemory = 0;
    
    // Find tabs with min/max values
    for (const tab of tabs) {
      const age = now.getTime() - tab.firstAccessed.getTime();
      totalAge += age;
      totalActiveTime += tab.totalActiveTime;
      totalMemory += tab.memoryUsage;
      
      // Update oldest tab
      if (!oldestTab || tab.firstAccessed < oldestTab.firstAccessed) {
        oldestTab = tab;
      }
      
      // Update newest tab
      if (!newestTab || tab.firstAccessed > newestTab.firstAccessed) {
        newestTab = tab;
      }
      
      // Update most active tab
      if (!mostActiveTab || tab.totalActiveTime > mostActiveTab.totalActiveTime) {
        mostActiveTab = tab;
      }
      
      // Update least active tab (only consider tabs that have been accessed)
      if (tab.activationCount > 0 && (!leastActiveTab || tab.totalActiveTime < leastActiveTab.totalActiveTime)) {
        leastActiveTab = tab;
      }
    }
    
    return {
      totalTabs: tabs.length,
      activeTabs,
      inactiveTabs: tabs.length - activeTabs,
      oldestTab,
      newestTab,
      mostActiveTab,
      leastActiveTab,
      averageTabAge: tabs.length > 0 ? totalAge / tabs.length : 0,
      averageActiveTime: tabs.length > 0 ? totalActiveTime / tabs.length : 0,
      totalMemoryUsage: totalMemory
    };
  }

  /**
   * Export tab activity data for analysis
   * Returns privacy-safe data for analytics
   */
  exportActivityData(): Partial<TabActivityData>[] {
    return Array.from(this.tabActivities.values()).map(tab => {
      // Create a privacy-focused export with minimal identifiable information
      const exportData: Partial<TabActivityData> = {
        category: tab.category,
        totalActiveTime: tab.totalActiveTime,
        activationCount: tab.activationCount,
        memoryUsage: tab.memoryUsage
      };
      
      // Only include domain information if detailed data collection is enabled
      if (this.options.collectDetailedData) {
        exportData.domain = tab.domain;
      }
      
      return exportData;
    });
  }

  /**
   * Update options for the tracker
   */
  updateOptions(options: Partial<TabActivityOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Restart memory tracking if interval changed
    if (options.memoryUpdateInterval !== undefined) {
      this.startMemoryTracking();
    }
  }

  /**
   * Get current options
   */
  getOptions(): TabActivityOptions {
    return { ...this.options };
  }

  /**
   * Start tracking memory usage
   */
  private startMemoryTracking(): void {
    // Clear existing interval if any
    if (this.memoryUpdateIntervalId !== null) {
      clearTimeout(this.memoryUpdateIntervalId);
      this.memoryUpdateIntervalId = null;
    }
    
    // Use a recursive setTimeout pattern which is more reliable in service workers
    const scheduleNextUpdate = () => {
      this.memoryUpdateIntervalId = setTimeout(async () => {
        await this.updateMemoryUsage();
        // Schedule next update if still active
        if (this.memoryUpdateIntervalId !== null) {
          scheduleNextUpdate();
        }
      }, this.options.memoryUpdateInterval) as unknown as number;
    };
    
    // Start the first update cycle
    scheduleNextUpdate();
  }

  /**
   * Stop memory tracking
   */
  stopMemoryTracking(): void {
    if (this.memoryUpdateIntervalId !== null) {
      clearTimeout(this.memoryUpdateIntervalId);
      this.memoryUpdateIntervalId = null;
    }
  }

  /**
   * Update memory usage for all tabs
   * Uses Chrome's performance API to estimate memory usage
   */
  private async updateMemoryUsage(): Promise<void> {
    try {
      // Check if the performance API is available
      if (!chrome.tabs || !chrome.tabs.query) {
        return;
      }
      
      // Get all tabs
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (!tab.id) continue;
        
        try {
          // In a real implementation, we would use chrome.processes.getProcessInfo
          // or other APIs to get actual memory usage
          // For now, we'll use a simple estimation based on tab age and activity
          
          const activityData = this.tabActivities.get(tab.id);
          if (activityData) {
            // Simulate memory usage based on tab properties
            // This is just a placeholder - real implementation would use actual metrics
            const baseMemory = 50000; // Base memory usage in KB (50MB)
            const ageMultiplier = Math.min(1, (Date.now() - activityData.firstAccessed.getTime()) / (24 * 60 * 60 * 1000));
            const activityMultiplier = Math.min(1, activityData.totalActiveTime / (60 * 60 * 1000));
            
            // Estimate memory usage
            const estimatedMemory = baseMemory * (1 + 0.5 * ageMultiplier + 0.5 * activityMultiplier);
            
            // Update tab data
            activityData.memoryUsage = Math.round(estimatedMemory);
            this.tabActivities.set(tab.id, activityData);
          }
        } catch (tabError) {
          console.error(`Error updating memory for tab ${tab.id}:`, tabError);
        }
      }
    } catch (error) {
      console.error('Error updating memory usage:', error);
    }
  }

  /**
   * Start tracking active time for a tab
   */
  private startTrackingActiveTime(tabId: number): void {
    // Record start time
    this.lastActiveTime.set(tabId, Date.now());
  }

  /**
   * Stop tracking active time for a tab and update total
   */
  private stopTrackingActiveTime(tabId: number): void {
    const startTime = this.lastActiveTime.get(tabId);
    if (!startTime) return;
    
    // Calculate active duration
    const activeTime = Date.now() - startTime;
    
    // Update tab data
    const tabData = this.tabActivities.get(tabId);
    if (tabData) {
      tabData.totalActiveTime += activeTime;
      tabData.isActive = false;
      this.tabActivities.set(tabId, tabData);
    }
    
    // Clear tracking
    this.lastActiveTime.delete(tabId);
  }

  /**
   * Sanitize URL for privacy
   */
  private sanitizeUrl(url: string): string {
    if (!this.options.anonymizeUrls) {
      return url;
    }
    
    try {
      // For privacy, only keep the domain part
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (e) {
      // If URL parsing fails, return a generic placeholder
      return 'about:blank';
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return '';
    }
  }

  /**
   * Sanitize tab title for privacy
   */
  private sanitizeTitle(title: string): string {
    if (!this.options.anonymizeUrls) {
      return title;
    }
    
    // For privacy, truncate long titles
    if (title.length > 30) {
      return title.substring(0, 27) + '...';
    }
    
    return title;
  }

  /**
   * Categorize website based on domain
   */
  private categorizeWebsite(domain: string): WebsiteCategory {
    // Simple categorization based on domain patterns
    const domainLower = domain.toLowerCase();
    
    // Work-related sites
    if (
      domainLower.includes('github.com') ||
      domainLower.includes('gitlab.com') ||
      domainLower.includes('stackoverflow.com') ||
      domainLower.includes('docs.') ||
      domainLower.includes('jira.') ||
      domainLower.includes('confluence.') ||
      domainLower.includes('notion.so') ||
      domainLower.includes('trello.com') ||
      domainLower.includes('asana.com') ||
      domainLower.includes('slack.com') ||
      domainLower.includes('teams.microsoft.com') ||
      domainLower.includes('meet.google.com') ||
      domainLower.includes('zoom.us')
    ) {
      return 'work';
    }
    
    // Social media
    if (
      domainLower.includes('facebook.com') ||
      domainLower.includes('twitter.com') ||
      domainLower.includes('instagram.com') ||
      domainLower.includes('linkedin.com') ||
      domainLower.includes('reddit.com') ||
      domainLower.includes('tiktok.com') ||
      domainLower.includes('pinterest.com') ||
      domainLower.includes('snapchat.com')
    ) {
      return 'social';
    }
    
    // Entertainment
    if (
      domainLower.includes('youtube.com') ||
      domainLower.includes('netflix.com') ||
      domainLower.includes('hulu.com') ||
      domainLower.includes('disney') ||
      domainLower.includes('spotify.com') ||
      domainLower.includes('twitch.tv') ||
      domainLower.includes('vimeo.com') ||
      domainLower.includes('hbomax.com') ||
      domainLower.includes('primevideo.com')
    ) {
      return 'entertainment';
    }
    
    // News
    if (
      domainLower.includes('news.') ||
      domainLower.includes('.news') ||
      domainLower.includes('nytimes.com') ||
      domainLower.includes('washingtonpost.com') ||
      domainLower.includes('bbc.') ||
      domainLower.includes('cnn.com') ||
      domainLower.includes('reuters.com') ||
      domainLower.includes('bloomberg.com') ||
      domainLower.includes('wsj.com')
    ) {
      return 'news';
    }
    
    // Shopping
    if (
      domainLower.includes('amazon.') ||
      domainLower.includes('ebay.') ||
      domainLower.includes('walmart.com') ||
      domainLower.includes('target.com') ||
      domainLower.includes('etsy.com') ||
      domainLower.includes('shop.') ||
      domainLower.includes('store.') ||
      domainLower.includes('shopping.')
    ) {
      return 'shopping';
    }
    
    // Default category
    return 'other';
  }

  /**
   * Clean up resources when tracker is no longer needed
   */
  cleanup(): void {
    this.stopMemoryTracking();
    this.tabActivities.clear();
    this.activeTabsByWindow.clear();
    this.lastActiveTime.clear();
  }
}