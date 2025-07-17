/**
 * AutoCloseManager for TabGuard Pro
 * 
 * Implements auto-close functionality for inactive tabs based on user configuration.
 * Includes whitelist mechanism, notifications, and undo capabilities.
 * 
 * Implements requirements:
 * - 2.5: Automatically close inactive tabs based on AI recommendations
 * - 5.3: Allow unlimited tabs for specified important websites (whitelist)
 */

import { TabActivityTracker } from './TabActivityTracker';
import { TabSuggestionEngine } from './TabSuggestionEngine';
import { UserConfig } from '../shared/types';

export interface AutoCloseOptions {
  // Whether auto-close is enabled
  enabled: boolean;
  
  // Time in minutes before auto-closing inactive tabs
  inactivityThreshold: number;
  
  // Maximum number of tabs to close in one batch
  maxTabsToClose: number;
  
  // Whether to show notifications before closing tabs
  showNotifications: boolean;
  
  // Time in seconds to wait after notification before closing tabs
  notificationDelay: number;
  
  // Whether to exclude pinned tabs from auto-close
  excludePinnedTabs: boolean;
  
  // Whether to exclude work-related tabs from auto-close
  excludeWorkTabs: boolean;
}

export interface WhitelistEntry {
  // Type of whitelist entry
  type: 'domain' | 'url' | 'pattern';
  
  // Value to match against (domain, full URL, or regex pattern)
  value: string;
  
  // Optional name for this whitelist entry
  name?: string;
  
  // When this entry was added
  addedAt: Date;
}

export interface ClosedTabInfo {
  // Tab ID (will be invalid after closure)
  tabId: number;
  
  // Tab title
  title: string;
  
  // Tab URL
  url: string;
  
  // When the tab was closed
  closedAt: Date;
  
  // How long the tab was inactive before closure (minutes)
  inactiveMinutes: number;
}

export class AutoCloseManager {
  private activityTracker: TabActivityTracker;
  private suggestionEngine: TabSuggestionEngine;
  private options: AutoCloseOptions;
  private whitelist: WhitelistEntry[] = [];
  private closedTabs: ClosedTabInfo[] = [];
  private autoCloseTimerId: number | null = null;
  private pendingClosures: number[] = [];
  private notificationTimers: Map<string, number> = new Map();
  
  // Default options
  private static readonly DEFAULT_OPTIONS: AutoCloseOptions = {
    enabled: false,
    inactivityThreshold: 30,
    maxTabsToClose: 3,
    showNotifications: true,
    notificationDelay: 30, // seconds
    excludePinnedTabs: true,
    excludeWorkTabs: true
  };
  
  constructor(
    activityTracker: TabActivityTracker,
    suggestionEngine: TabSuggestionEngine,
    options?: Partial<AutoCloseOptions>
  ) {
    this.activityTracker = activityTracker;
    this.suggestionEngine = suggestionEngine;
    this.options = { ...AutoCloseManager.DEFAULT_OPTIONS, ...options };
    
    // Load whitelist from storage
    this.loadWhitelist();
  }
  
  /**
   * Initialize auto-close functionality
   */
  async initialize(config: UserConfig): Promise<void> {
    try {
      // Update options from user config
      this.updateFromConfig(config);
      
      // Start auto-close timer if enabled
      if (this.options.enabled) {
        this.startAutoCloseTimer();
      }
      
      console.log('AutoCloseManager initialized with options:', this.options);
    } catch (error) {
      console.error('Failed to initialize AutoCloseManager:', error);
    }
  }
  
  /**
   * Update options from user configuration
   */
  updateFromConfig(config: UserConfig): void {
    this.options = {
      ...this.options,
      enabled: config.autoCloseEnabled,
      inactivityThreshold: config.autoCloseDelay
    };
    
    // Restart timer if settings changed
    this.restartTimer();
  }
  
  /**
   * Start the auto-close timer
   */
  private startAutoCloseTimer(): void {
    // Clear existing timer if any
    this.stopAutoCloseTimer();
    
    // Check for tabs to close every minute
    const checkInterval = 60 * 1000; // 1 minute
    
    // Use a recursive setTimeout pattern which is more reliable in service workers
    const scheduleNextCheck = () => {
      this.autoCloseTimerId = setTimeout(async () => {
        if (this.options.enabled) {
          await this.checkForTabsToClose();
        }
        
        // Schedule next check if still enabled
        if (this.options.enabled) {
          scheduleNextCheck();
        }
      }, checkInterval) as unknown as number;
    };
    
    // Start the first check cycle
    scheduleNextCheck();
    
    console.log('Auto-close timer started with interval:', checkInterval, 'ms');
  }
  
  /**
   * Stop the auto-close timer
   */
  private stopAutoCloseTimer(): void {
    if (this.autoCloseTimerId !== null) {
      clearTimeout(this.autoCloseTimerId);
      this.autoCloseTimerId = null;
      console.log('Auto-close timer stopped');
    }
  }
  
  /**
   * Restart the timer when settings change
   */
  private restartTimer(): void {
    if (this.options.enabled) {
      this.startAutoCloseTimer();
    } else {
      this.stopAutoCloseTimer();
    }
  }
  
  /**
   * Check for tabs that should be auto-closed
   */
  private async checkForTabsToClose(): Promise<void> {
    try {
      if (!this.options.enabled) {
        return;
      }
      
      console.log('Checking for tabs to auto-close...');
      
      // Get tab suggestions from the suggestion engine
      const suggestions = await this.suggestionEngine.getSuggestions({
        maxSuggestions: this.options.maxTabsToClose,
        minInactivityMinutes: this.options.inactivityThreshold,
        includePinnedTabs: !this.options.excludePinnedTabs,
        prioritizeMemoryUsage: true,
        prioritizeLowProductivity: true,
        excludeWorkTabs: this.options.excludeWorkTabs
      });
      
      if (suggestions.length === 0) {
        console.log('No tabs eligible for auto-closure');
        return;
      }
      
      // Filter out whitelisted tabs
      const nonWhitelistedTabs = suggestions.filter(tab => !this.isWhitelisted(tab.url));
      
      if (nonWhitelistedTabs.length === 0) {
        console.log('All candidate tabs are whitelisted');
        return;
      }
      
      console.log(`Found ${nonWhitelistedTabs.length} tabs eligible for auto-closure`);
      
      // Store tabs that will be closed
      this.pendingClosures = nonWhitelistedTabs.map(tab => tab.tabId);
      
      if (this.options.showNotifications) {
        // Show notification with delay before closing
        await this.showAutoCloseNotification(nonWhitelistedTabs);
      } else {
        // Close tabs immediately
        await this.closeTabsAfterDelay(nonWhitelistedTabs, 0);
      }
    } catch (error) {
      console.error('Error checking for tabs to auto-close:', error);
    }
  }
  
  /**
   * Show notification before auto-closing tabs
   */
  private async showAutoCloseNotification(tabs: Array<any>): Promise<void> {
    try {
      const tabCount = tabs.length;
      const notificationId = `auto-close-${Date.now()}`;
      
      // Create notification text
      const notificationTitle = 'TabGuard Pro - Auto-Close';
      const notificationMessage = `${tabCount} inactive tab${tabCount > 1 ? 's' : ''} will be closed in ${this.options.notificationDelay} seconds. Click this notification to cancel.`;
      
      // Create and show notification
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: '/icons/icon48.png',
        title: notificationTitle,
        message: notificationMessage,
        priority: 2,
        buttons: [
          { title: 'Cancel Auto-Close' },
          { title: 'Close Now' }
        ],
        requireInteraction: true // Keep notification visible until user interacts with it
      });
      
      // Set up notification click handler (for cancellation)
      const onNotificationClicked = (clickedId: string) => {
        if (clickedId === notificationId) {
          console.log('Auto-close cancelled by user');
          this.cancelPendingClosures();
          chrome.notifications.clear(notificationId);
          chrome.notifications.onClicked.removeListener(onNotificationClicked);
          chrome.notifications.onButtonClicked.removeListener(onButtonClicked);
        }
      };
      
      // Set up button click handler
      const onButtonClicked = (clickedId: string, buttonIndex: number) => {
        if (clickedId === notificationId) {
          if (buttonIndex === 0) {
            // Cancel button clicked
            console.log('Auto-close cancelled by user (button)');
            this.cancelPendingClosures();
          } else if (buttonIndex === 1) {
            // Close now button clicked
            console.log('Auto-close accelerated by user');
            this.closeTabsAfterDelay(tabs, 0);
          }
          
          chrome.notifications.clear(notificationId);
          chrome.notifications.onClicked.removeListener(onNotificationClicked);
          chrome.notifications.onButtonClicked.removeListener(onButtonClicked);
        }
      };
      
      // Add event listeners
      chrome.notifications.onClicked.addListener(onNotificationClicked);
      chrome.notifications.onButtonClicked.addListener(onButtonClicked);
      
      // Set timer to close tabs after delay
      const timerId = setTimeout(() => {
        this.closeTabsAfterDelay(tabs, 0);
        chrome.notifications.clear(notificationId);
        chrome.notifications.onClicked.removeListener(onNotificationClicked);
        chrome.notifications.onButtonClicked.removeListener(onButtonClicked);
      }, this.options.notificationDelay * 1000) as unknown as number;
      
      // Store timer ID for potential cancellation
      this.notificationTimers.set(notificationId, timerId);
      
    } catch (error) {
      console.error('Error showing auto-close notification:', error);
    }
  }
  
  /**
   * Close tabs after specified delay
   */
  private async closeTabsAfterDelay(tabs: Array<any>, delayMs: number): Promise<void> {
    try {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Check if closure was cancelled
      if (this.pendingClosures.length === 0) {
        console.log('Tab closure was cancelled');
        return;
      }
      
      // Get tab IDs to close
      const tabIds = tabs.map(tab => tab.tabId);
      
      // Store information about tabs being closed for potential undo
      const closedTabsInfo: ClosedTabInfo[] = tabs.map(tab => ({
        tabId: tab.tabId,
        title: tab.title,
        url: tab.url,
        closedAt: new Date(),
        inactiveMinutes: tab.inactiveMinutes
      }));
      
      // Add to closed tabs history (limit to last 20)
      this.closedTabs = [...closedTabsInfo, ...this.closedTabs].slice(0, 20);
      
      // Save closed tabs to storage for persistence
      this.saveClosedTabs();
      
      // Close the tabs
      await chrome.tabs.remove(tabIds);
      console.log(`Auto-closed ${tabIds.length} tabs`);
      
      // Clear pending closures
      this.pendingClosures = [];
      
      // Show confirmation notification
      if (this.options.showNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon48.png',
          title: 'TabGuard Pro - Tabs Closed',
          message: `${tabIds.length} inactive tab${tabIds.length > 1 ? 's were' : ' was'} automatically closed. Click to undo.`,
          priority: 1,
          isClickable: true
        }, notificationId => {
          // Add click handler for undo
          const onNotificationClicked = (clickedId: string) => {
            if (clickedId === notificationId) {
              this.undoLastClosure();
              chrome.notifications.clear(notificationId);
              chrome.notifications.onClicked.removeListener(onNotificationClicked);
            }
          };
          
          chrome.notifications.onClicked.addListener(onNotificationClicked);
        });
      }
    } catch (error) {
      console.error('Error closing tabs after delay:', error);
    }
  }
  
  /**
   * Cancel pending tab closures
   */
  cancelPendingClosures(): void {
    this.pendingClosures = [];
    
    // Clear all notification timers
    for (const timerId of this.notificationTimers.values()) {
      clearTimeout(timerId);
    }
    
    this.notificationTimers.clear();
  }
  
  /**
   * Undo the last batch of closed tabs
   */
  async undoLastClosure(): Promise<boolean> {
    try {
      // Get the most recent batch of closed tabs (tabs closed at the same time)
      if (this.closedTabs.length === 0) {
        console.log('No closed tabs to restore');
        return false;
      }
      
      const mostRecentTime = this.closedTabs[0].closedAt.getTime();
      const tabsToRestore = this.closedTabs.filter(
        tab => tab.closedAt.getTime() === mostRecentTime
      );
      
      if (tabsToRestore.length === 0) {
        return false;
      }
      
      console.log(`Restoring ${tabsToRestore.length} recently closed tabs`);
      
      // Restore each tab
      for (const tab of tabsToRestore) {
        await chrome.tabs.create({ url: tab.url, active: false });
      }
      
      // Remove restored tabs from history
      this.closedTabs = this.closedTabs.filter(
        tab => tab.closedAt.getTime() !== mostRecentTime
      );
      
      // Update storage
      this.saveClosedTabs();
      
      return true;
    } catch (error) {
      console.error('Error undoing last closure:', error);
      return false;
    }
  }
  
  /**
   * Check if a URL is in the whitelist
   */
  isWhitelisted(url: string): boolean {
    try {
      if (!url || this.whitelist.length === 0) {
        return false;
      }
      
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      return this.whitelist.some(entry => {
        switch (entry.type) {
          case 'domain':
            return domain === entry.value || domain.endsWith(`.${entry.value}`);
          
          case 'url':
            return url === entry.value;
          
          case 'pattern':
            try {
              const regex = new RegExp(entry.value);
              return regex.test(url);
            } catch (e) {
              console.error('Invalid regex pattern in whitelist:', entry.value);
              return false;
            }
          
          default:
            return false;
        }
      });
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return false;
    }
  }
  
  /**
   * Add a URL or domain to the whitelist
   */
  async addToWhitelist(entry: Omit<WhitelistEntry, 'addedAt'>): Promise<boolean> {
    try {
      // Validate entry
      if (!entry.value) {
        console.error('Invalid whitelist entry: missing value');
        return false;
      }
      
      // Check if already in whitelist
      const exists = this.whitelist.some(
        e => e.type === entry.type && e.value === entry.value
      );
      
      if (exists) {
        console.log('Entry already in whitelist:', entry);
        return false;
      }
      
      // Add to whitelist
      const newEntry: WhitelistEntry = {
        ...entry,
        addedAt: new Date()
      };
      
      this.whitelist.push(newEntry);
      
      // Save to storage
      await this.saveWhitelist();
      
      console.log('Added to whitelist:', newEntry);
      return true;
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      return false;
    }
  }
  
  /**
   * Remove an entry from the whitelist
   */
  async removeFromWhitelist(type: string, value: string): Promise<boolean> {
    try {
      const initialLength = this.whitelist.length;
      
      this.whitelist = this.whitelist.filter(
        entry => !(entry.type === type && entry.value === value)
      );
      
      if (this.whitelist.length < initialLength) {
        await this.saveWhitelist();
        console.log('Removed from whitelist:', { type, value });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      return false;
    }
  }
  
  /**
   * Get the current whitelist
   */
  getWhitelist(): WhitelistEntry[] {
    return [...this.whitelist];
  }
  
  /**
   * Get recently closed tabs
   */
  getClosedTabs(): ClosedTabInfo[] {
    return [...this.closedTabs];
  }
  
  /**
   * Update auto-close options
   */
  updateOptions(options: Partial<AutoCloseOptions>): void {
    const wasEnabled = this.options.enabled;
    
    this.options = {
      ...this.options,
      ...options
    };
    
    // Restart timer if enabled state changed
    if (wasEnabled !== this.options.enabled) {
      this.restartTimer();
    }
    
    console.log('Auto-close options updated:', this.options);
  }
  
  /**
   * Get current auto-close options
   */
  getOptions(): AutoCloseOptions {
    return { ...this.options };
  }
  
  /**
   * Load whitelist from storage
   */
  private async loadWhitelist(): Promise<void> {
    try {
      const { autoCloseWhitelist } = await chrome.storage.sync.get('autoCloseWhitelist');
      
      if (Array.isArray(autoCloseWhitelist)) {
        this.whitelist = autoCloseWhitelist.map(entry => ({
          ...entry,
          addedAt: new Date(entry.addedAt)
        }));
        
        console.log(`Loaded ${this.whitelist.length} whitelist entries`);
      }
    } catch (error) {
      console.error('Error loading whitelist:', error);
    }
  }
  
  /**
   * Save whitelist to storage
   */
  private async saveWhitelist(): Promise<void> {
    try {
      await chrome.storage.sync.set({ autoCloseWhitelist: this.whitelist });
    } catch (error) {
      console.error('Error saving whitelist:', error);
    }
  }
  
  /**
   * Save closed tabs history to storage
   */
  private async saveClosedTabs(): Promise<void> {
    try {
      await chrome.storage.local.set({ autoCloseHistory: this.closedTabs });
    } catch (error) {
      console.error('Error saving closed tabs history:', error);
    }
  }
  
  /**
   * Load closed tabs history from storage
   */
  private async loadClosedTabs(): Promise<void> {
    try {
      const { autoCloseHistory } = await chrome.storage.local.get('autoCloseHistory');
      
      if (Array.isArray(autoCloseHistory)) {
        this.closedTabs = autoCloseHistory.map(tab => ({
          ...tab,
          closedAt: new Date(tab.closedAt)
        }));
      }
    } catch (error) {
      console.error('Error loading closed tabs history:', error);
    }
  }
  
  /**
   * Clean up resources when manager is no longer needed
   */
  cleanup(): void {
    this.stopAutoCloseTimer();
    this.cancelPendingClosures();
    this.notificationTimers.clear();
  }
  
  /**
   * Test helper method to check for tabs to close
   * This method is only used for testing purposes
   */
  async testCheckForTabsToClose(): Promise<void> {
    return this.checkForTabsToClose();
  }
  
  /**
   * Test helper method to set closed tabs (for testing only)
   */
  testSetClosedTabs(tabs: ClosedTabInfo[]): void {
    this.closedTabs = [...tabs];
  }
}