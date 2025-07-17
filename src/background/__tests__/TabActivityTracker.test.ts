/**
 * Tests for TabActivityTracker
 */

import { TabActivityTracker, TabActivityOptions } from '../TabActivityTracker';

// Mock chrome API
global.chrome = {
  tabs: {
    query: jest.fn()
  }
} as any;

describe('TabActivityTracker', () => {
  let tracker: TabActivityTracker;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create tracker with test options
    const options: Partial<TabActivityOptions> = {
      memoryUpdateInterval: 1000, // 1 second for faster testing
      inactivityThreshold: 5, // 5 minutes for testing
      collectDetailedData: false,
      anonymizeUrls: true
    };
    
    tracker = new TabActivityTracker(options);
    
    // Mock setInterval to prevent actual intervals during tests
    jest.spyOn(window, 'setInterval').mockImplementation(() => 123 as any);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up
    tracker.cleanup();
  });
  
  test('should initialize with default options', () => {
    const defaultTracker = new TabActivityTracker();
    const options = defaultTracker.getOptions();
    
    expect(options.memoryUpdateInterval).toBe(60000);
    expect(options.inactivityThreshold).toBe(30);
    expect(options.collectDetailedData).toBe(false);
    expect(options.anonymizeUrls).toBe(true);
    
    defaultTracker.cleanup();
  });
  
  test('should initialize with custom options', () => {
    const options = tracker.getOptions();
    
    expect(options.memoryUpdateInterval).toBe(1000);
    expect(options.inactivityThreshold).toBe(5);
    expect(options.collectDetailedData).toBe(false);
    expect(options.anonymizeUrls).toBe(true);
  });
  
  test('should track a new tab', () => {
    const tab = {
      id: 123,
      windowId: 1,
      active: true,
      url: 'https://example.com/page?query=test',
      title: 'Example Page'
    };
    
    tracker.trackTab(tab as chrome.tabs.Tab);
    
    // Get activity summary to check if tab was tracked
    const summary = tracker.getActivitySummary();
    
    expect(summary.totalTabs).toBe(1);
    expect(summary.activeTabs).toBe(1);
  });
  
  test('should update tab data when tab is updated', () => {
    // First add a tab
    const tab = {
      id: 123,
      windowId: 1,
      active: true,
      url: 'https://example.com/page',
      title: 'Example Page'
    };
    
    tracker.trackTab(tab as chrome.tabs.Tab);
    
    // Now update the tab
    const changeInfo = {
      url: 'https://example.com/new-page',
      title: 'New Page Title'
    };
    
    tracker.updateTab(123, changeInfo as chrome.tabs.TabChangeInfo, tab as chrome.tabs.Tab);
    
    // Export data to check if update was applied
    const data = tracker.exportActivityData();
    
    expect(data.length).toBe(1);
  });
  
  test('should handle tab activation', () => {
    // Add two tabs
    const tab1 = {
      id: 123,
      windowId: 1,
      active: false,
      url: 'https://example.com/page1',
      title: 'Example Page 1'
    };
    
    const tab2 = {
      id: 456,
      windowId: 1,
      active: false,
      url: 'https://example.com/page2',
      title: 'Example Page 2'
    };
    
    tracker.trackTab(tab1 as chrome.tabs.Tab);
    tracker.trackTab(tab2 as chrome.tabs.Tab);
    
    // Activate tab2
    tracker.activateTab({
      tabId: 456,
      windowId: 1
    });
    
    // Get summary to check active tabs
    const summary = tracker.getActivitySummary();
    
    expect(summary.totalTabs).toBe(2);
    expect(summary.activeTabs).toBe(1);
  });
  
  test('should remove tab from tracking when closed', () => {
    // Add a tab
    const tab = {
      id: 123,
      windowId: 1,
      active: true,
      url: 'https://example.com/page',
      title: 'Example Page'
    };
    
    tracker.trackTab(tab as chrome.tabs.Tab);
    
    // Remove the tab
    tracker.removeTab(123);
    
    // Check if tab was removed
    const summary = tracker.getActivitySummary();
    
    expect(summary.totalTabs).toBe(0);
  });
  
  test('should remove all tabs from a closed window', () => {
    // Add tabs in two windows
    const tab1 = {
      id: 123,
      windowId: 1,
      active: true,
      url: 'https://example.com/page1',
      title: 'Example Page 1'
    };
    
    const tab2 = {
      id: 456,
      windowId: 1,
      active: false,
      url: 'https://example.com/page2',
      title: 'Example Page 2'
    };
    
    const tab3 = {
      id: 789,
      windowId: 2,
      active: true,
      url: 'https://example.com/page3',
      title: 'Example Page 3'
    };
    
    tracker.trackTab(tab1 as chrome.tabs.Tab);
    tracker.trackTab(tab2 as chrome.tabs.Tab);
    tracker.trackTab(tab3 as chrome.tabs.Tab);
    
    // Close window 1
    tracker.removeWindow(1);
    
    // Check if tabs from window 1 were removed
    const summary = tracker.getActivitySummary();
    
    expect(summary.totalTabs).toBe(1);
  });
  
  test('should initialize from existing tabs', async () => {
    // Mock chrome.tabs.query to return test tabs
    const mockTabs = [
      {
        id: 123,
        windowId: 1,
        active: true,
        url: 'https://example.com/page1',
        title: 'Example Page 1'
      },
      {
        id: 456,
        windowId: 1,
        active: false,
        url: 'https://example.com/page2',
        title: 'Example Page 2'
      }
    ];
    
    (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);
    
    // Initialize from existing tabs
    await tracker.initializeFromExistingTabs();
    
    // Check if tabs were added
    const summary = tracker.getActivitySummary();
    
    expect(summary.totalTabs).toBe(2);
    expect(summary.activeTabs).toBe(1);
  });
  
  test('should export privacy-safe activity data', () => {
    // Add a tab with sensitive URL
    const tab = {
      id: 123,
      windowId: 1,
      active: true,
      url: 'https://example.com/private/user?id=12345&token=secret',
      title: 'Private User Page with Sensitive Info'
    };
    
    tracker.trackTab(tab as chrome.tabs.Tab);
    
    // Export data
    const data = tracker.exportActivityData();
    
    expect(data.length).toBe(1);
    expect(data[0].url).toBeUndefined(); // URL should not be included
    expect(data[0].title).toBeUndefined(); // Title should not be included
    expect(data[0].category).toBe('other'); // Category should be included
  });
  
  test('should update options', () => {
    // Update options
    tracker.updateOptions({
      collectDetailedData: true,
      anonymizeUrls: false
    });
    
    // Check if options were updated
    const options = tracker.getOptions();
    
    expect(options.collectDetailedData).toBe(true);
    expect(options.anonymizeUrls).toBe(false);
  });
});