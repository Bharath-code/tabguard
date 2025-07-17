/**
 * Tests for TabSuggestionEngine
 */

import { TabSuggestionEngine } from '../TabSuggestionEngine';
import { TabActivityTracker, TabActivityData } from '../TabActivityTracker';

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');

// Mock chrome API
global.chrome = {
  tabs: {
    query: jest.fn()
  }
} as any;

describe('TabSuggestionEngine', () => {
  let suggestionEngine: TabSuggestionEngine;
  let mockActivityTracker: jest.Mocked<TabActivityTracker>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock activity tracker
    mockActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;
    
    // Create suggestion engine with mock tracker
    suggestionEngine = new TabSuggestionEngine(mockActivityTracker);
  });
  
  test('should return empty array when no inactive tabs', async () => {
    // Mock getInactiveTabs to return empty array
    mockActivityTracker.getInactiveTabs.mockReturnValue([]);
    
    // Get suggestions
    const suggestions = await suggestionEngine.getSuggestions();
    
    // Verify results
    expect(suggestions).toEqual([]);
    expect(mockActivityTracker.getInactiveTabs).toHaveBeenCalledWith(30); // Default threshold
  });
  
  test('should score and sort tabs correctly', async () => {
    // Create mock inactive tabs
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    
    const mockInactiveTabs: TabActivityData[] = [
      {
        tabId: 1,
        url: 'https://github.com/project',
        title: 'GitHub Project',
        domain: 'github.com',
        firstAccessed: threeHoursAgo,
        lastAccessed: twoHoursAgo,
        totalActiveTime: 3600000,
        activationCount: 5,
        memoryUsage: 150000,
        category: 'work',
        isActive: false,
        windowId: 1
      },
      {
        tabId: 2,
        url: 'https://facebook.com/feed',
        title: 'Facebook',
        domain: 'facebook.com',
        firstAccessed: twoHoursAgo,
        lastAccessed: oneHourAgo,
        totalActiveTime: 1800000,
        activationCount: 3,
        memoryUsage: 200000,
        category: 'social',
        isActive: false,
        windowId: 1
      },
      {
        tabId: 3,
        url: 'https://netflix.com/browse',
        title: 'Netflix',
        domain: 'netflix.com',
        firstAccessed: oneHourAgo,
        lastAccessed: oneHourAgo,
        totalActiveTime: 900000,
        activationCount: 2,
        memoryUsage: 300000,
        category: 'entertainment',
        isActive: false,
        windowId: 1
      }
    ];
    
    // Mock getInactiveTabs to return our test data
    mockActivityTracker.getInactiveTabs.mockReturnValue(mockInactiveTabs);
    
    // Mock chrome.tabs.query to return pinned status
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      { id: 1, pinned: false },
      { id: 2, pinned: false },
      { id: 3, pinned: false }
    ]);
    
    // Get suggestions with default criteria (excludes work tabs)
    const suggestions = await suggestionEngine.getSuggestions();
    
    // Verify results
    expect(suggestions.length).toBe(2); // Work tab should be excluded
    
    // Entertainment tab should be first (higher score due to memory and low productivity)
    expect(suggestions[0].tabId).toBe(3);
    expect(suggestions[0].category).toBe('entertainment');
    
    // Social tab should be second
    expect(suggestions[1].tabId).toBe(2);
    expect(suggestions[1].category).toBe('social');
  });
  
  test('should respect custom criteria', async () => {
    // Create mock inactive tabs
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const mockInactiveTabs: TabActivityData[] = [
      {
        tabId: 1,
        url: 'https://github.com/project',
        title: 'GitHub Project',
        domain: 'github.com',
        firstAccessed: twoHoursAgo,
        lastAccessed: oneHourAgo,
        totalActiveTime: 3600000,
        activationCount: 5,
        memoryUsage: 150000,
        category: 'work',
        isActive: false,
        windowId: 1
      },
      {
        tabId: 2,
        url: 'https://facebook.com/feed',
        title: 'Facebook',
        domain: 'facebook.com',
        firstAccessed: twoHoursAgo,
        lastAccessed: oneHourAgo,
        totalActiveTime: 1800000,
        activationCount: 3,
        memoryUsage: 200000,
        category: 'social',
        isActive: false,
        windowId: 1
      }
    ];
    
    // Mock getInactiveTabs to return our test data
    mockActivityTracker.getInactiveTabs.mockReturnValue(mockInactiveTabs);
    
    // Mock chrome.tabs.query to return pinned status
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      { id: 1, pinned: true },
      { id: 2, pinned: false }
    ]);
    
    // Get suggestions with custom criteria
    const suggestions = await suggestionEngine.getSuggestions({
      excludeWorkTabs: false,
      includePinnedTabs: true,
      minInactivityMinutes: 45
    });
    
    // Verify results
    expect(suggestions.length).toBe(2); // Both tabs should be included
    expect(mockActivityTracker.getInactiveTabs).toHaveBeenCalledWith(45); // Custom threshold
  });
  
  test('should format time since last access correctly', () => {
    const now = new Date();
    
    // Just now
    const justNow = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(justNow)).toBe('just now');
    
    // Minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(fiveMinutesAgo)).toBe('5 minutes ago');
    
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(oneMinuteAgo)).toBe('1 minute ago');
    
    // Hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(twoHoursAgo)).toBe('2 hours ago');
    
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(oneHourAgo)).toBe('1 hour ago');
    
    // Days
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(threeDaysAgo)).toBe('3 days ago');
    
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    expect(TabSuggestionEngine.formatTimeSinceLastAccess(oneDayAgo)).toBe('1 day ago');
  });
  
  test('should format memory usage correctly', () => {
    // Kilobytes
    expect(TabSuggestionEngine.formatMemoryUsage(512)).toBe('512 KB');
    
    // Megabytes
    expect(TabSuggestionEngine.formatMemoryUsage(1536)).toBe('1.5 MB');
    expect(TabSuggestionEngine.formatMemoryUsage(2048)).toBe('2.0 MB');
  });
});