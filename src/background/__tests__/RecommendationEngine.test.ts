/**
 * Tests for RecommendationEngine
 */

import { RecommendationEngine } from '../RecommendationEngine';
import { TabActivityTracker } from '../TabActivityTracker';
import { BrowsingAnalytics } from '../BrowsingAnalytics';
import { ProductivityInsights, WebsiteCategory, CategoryBreakdown } from '../../shared/types';

// Mock chrome API
global.chrome = {
  tabs: {
    query: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
} as any;

// Properly type the mocked functions
const mockedGet = chrome.storage.local.get as jest.Mock;
const mockedSet = chrome.storage.local.set as jest.Mock;

// Mock TabActivityTracker and BrowsingAnalytics
jest.mock('../TabActivityTracker');
jest.mock('../BrowsingAnalytics');

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockActivityTracker: jest.Mocked<TabActivityTracker>;
  let mockBrowsingAnalytics: jest.Mocked<BrowsingAnalytics>;
  let mockInsights: ProductivityInsights;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup storage mock
    mockedGet.mockImplementation((keys, callback) => {
      if (callback) {
        callback({ userConfig: JSON.stringify({ tabLimit: 10 }) });
      }
      return Promise.resolve({ userConfig: JSON.stringify({ tabLimit: 10 }) });
    });
    
    mockedSet.mockImplementation(() => Promise.resolve());
    
    // Setup activity tracker mock
    mockActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;
    
    // Mock getActivitySummary
    mockActivityTracker.getActivitySummary.mockReturnValue({
      totalTabs: 12,
      activeTabs: 3,
      inactiveTabs: 9,
      oldestTab: null,
      newestTab: null,
      mostActiveTab: null,
      leastActiveTab: null,
      averageTabAge: 3600000, // 1 hour
      averageActiveTime: 1200000, // 20 minutes
      totalMemoryUsage: 500000 // 500MB
    });
    
    // Setup browsing analytics mock
    mockBrowsingAnalytics = new BrowsingAnalytics(mockActivityTracker) as jest.Mocked<BrowsingAnalytics>;
    
    // Create mock insights
    mockInsights = {
      productivityScore: 6.5,
      timeDistribution: {
        'work': 3600000, // 1 hour
        'social': 1800000, // 30 minutes
        'entertainment': 1200000, // 20 minutes
        'news': 600000, // 10 minutes
        'shopping': 300000, // 5 minutes
        'other': 900000 // 15 minutes
      },
      focusMetrics: {
        focusScore: 7.2,
        longestFocusSession: 35, // minutes
        distractionCount: 12,
        averageFocusTime: 18 // minutes
      },
      recommendations: [],
      categoryBreakdown: [
        {
          category: 'work' as WebsiteCategory,
          timeSpent: 3600000,
          tabCount: 4,
          percentage: 42.9
        },
        {
          category: 'social' as WebsiteCategory,
          timeSpent: 1800000,
          tabCount: 3,
          percentage: 21.4
        },
        {
          category: 'entertainment' as WebsiteCategory,
          timeSpent: 1200000,
          tabCount: 2,
          percentage: 14.3
        },
        {
          category: 'news' as WebsiteCategory,
          timeSpent: 600000,
          tabCount: 1,
          percentage: 7.1
        },
        {
          category: 'shopping' as WebsiteCategory,
          timeSpent: 300000,
          tabCount: 1,
          percentage: 3.6
        },
        {
          category: 'other' as WebsiteCategory,
          timeSpent: 900000,
          tabCount: 1,
          percentage: 10.7
        }
      ]
    };
    
    // Mock getWeekInsights
    mockBrowsingAnalytics.getWeekInsights.mockResolvedValue(mockInsights);
    
    // Create recommendation engine
    engine = new RecommendationEngine(mockActivityTracker, mockBrowsingAnalytics);
  });
  
  test('should generate optimal tab limit recommendations', async () => {
    const recommendation = await engine.getOptimalTabLimit(mockInsights);
    
    expect(recommendation).toBeDefined();
    expect(recommendation.currentLimit).toBe(10);
    expect(recommendation.recommendedLimit).toBeGreaterThanOrEqual(3);
    expect(recommendation.recommendedLimit).toBeLessThanOrEqual(30);
    expect(recommendation.confidence).toBeGreaterThan(0);
    expect(recommendation.confidence).toBeLessThanOrEqual(1);
    expect(recommendation.reasoning).toBeTruthy();
  });
  
  test('should generate focus time recommendations', async () => {
    const recommendations = await engine.getFocusTimeRecommendations(mockInsights);
    
    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);
    
    const recommendation = recommendations[0];
    expect(recommendation.recommendedDuration).toBeGreaterThan(0);
    expect(recommendation.recommendedStartTime).toMatch(/^\d{2}:\d{2}$/);
    expect(['focus', 'break']).toContain(recommendation.category);
    expect(recommendation.reasoning).toBeTruthy();
  });
  
  test('should generate personalized recommendations', async () => {
    const recommendations = await engine.getPersonalizedRecommendations(mockInsights);
    
    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);
    
    // Check that we have different types of recommendations
    const types = recommendations.map(r => r.type);
    expect(types).toContain('general');
    
    // Check that actionable recommendations have actions
    const actionableRecs = recommendations.filter(r => r.actionable);
    expect(actionableRecs.every(r => r.action !== undefined)).toBe(true);
  });
  
  test('should generate weekly report', async () => {
    const report = await engine.generateWeeklyReport();
    
    expect(report).toBeDefined();
    expect(report.productivityScore).toBe(mockInsights.productivityScore);
    expect(report.topCategories).toHaveLength(3);
    expect(report.recommendations).toBeDefined();
    expect(report.insights).toBeDefined();
    expect(report.insights.length).toBeGreaterThan(0);
    
    // Check date format
    expect(report.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  
  test('should handle low productivity scenarios', async () => {
    // Create low productivity insights
    const lowProductivityInsights: ProductivityInsights = {
      ...mockInsights,
      productivityScore: 3.2,
      focusMetrics: {
        ...mockInsights.focusMetrics,
        focusScore: 4.1
      }
    };
    
    mockBrowsingAnalytics.getWeekInsights.mockResolvedValue(lowProductivityInsights);
    
    const recommendations = await engine.getPersonalizedRecommendations(lowProductivityInsights);
    
    // Should have more recommendations for low productivity
    expect(recommendations.length).toBeGreaterThan(1);
    
    // Should include focus time recommendation
    const focusRec = recommendations.find(r => r.type === 'focus_time');
    expect(focusRec).toBeDefined();
  });
  
  test('should handle high tab count scenarios', async () => {
    // Mock high tab count
    mockActivityTracker.getActivitySummary.mockReturnValue({
      totalTabs: 25,
      activeTabs: 5,
      inactiveTabs: 20,
      oldestTab: null,
      newestTab: null,
      mostActiveTab: null,
      leastActiveTab: null,
      averageTabAge: 3600000,
      averageActiveTime: 1200000,
      totalMemoryUsage: 1200000 // 1.2GB
    });
    
    const recommendations = await engine.getPersonalizedRecommendations(mockInsights);
    
    // Should include tab closure recommendation
    const tabRec = recommendations.find(r => 
      r.type === 'general' && 
      r.title.includes('Close inactive tabs')
    );
    
    expect(tabRec).toBeDefined();
    expect(tabRec?.actionable).toBe(true);
    expect(tabRec?.action?.type).toBe('close_tabs');
  });
  
  test('should handle excessive social media usage', async () => {
    // Create insights with high social media usage
    const highSocialInsights: ProductivityInsights = {
      ...mockInsights,
      categoryBreakdown: [
        {
          category: 'social' as WebsiteCategory,
          timeSpent: 4800000, // 80 minutes
          tabCount: 5,
          percentage: 45.0
        },
        {
          category: 'work' as WebsiteCategory,
          timeSpent: 3600000, // 60 minutes
          tabCount: 4,
          percentage: 33.0
        },
        {
          category: 'other' as WebsiteCategory,
          timeSpent: 2400000, // 40 minutes
          tabCount: 3,
          percentage: 22.0
        }
      ]
    };
    
    const recommendations = await engine.getPersonalizedRecommendations(highSocialInsights);
    
    // Should include social media recommendation
    const socialRec = recommendations.find(r => 
      r.type === 'category_limit' && 
      r.title.includes('Reduce social media')
    );
    
    expect(socialRec).toBeDefined();
    expect(socialRec?.action?.value).toBe('social');
  });
});