/**
 * Tests for background service worker
 */

import { getTabManager, getTabActivityTracker, getTabSuggestionEngine, getRecommendationEngine } from '../background';

// Mock chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn()
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
  },
  runtime: {
    sendMessage: jest.fn()
  },
  notifications: {
    create: jest.fn()
  }
} as any;

// Properly type the mocked functions
const mockedGet = chrome.storage.local.get as jest.Mock;
const mockedSet = chrome.storage.local.set as jest.Mock;
const mockedSyncGet = chrome.storage.sync.get as jest.Mock;
const mockedSyncSet = chrome.storage.sync.set as jest.Mock;
const mockedTabsQuery = chrome.tabs.query as jest.Mock;
const mockedTabsCreate = chrome.tabs.create as jest.Mock;
const mockedTabsRemove = chrome.tabs.remove as jest.Mock;
const mockedTabsUpdate = chrome.tabs.update as jest.Mock;
const mockedSendMessage = chrome.runtime.sendMessage as jest.Mock;
const mockedNotificationsCreate = chrome.notifications.create as jest.Mock;

// Mock modules
jest.mock('../TabManager');
jest.mock('../TabActivityTracker');
jest.mock('../TabSuggestionEngine');
jest.mock('../BrowsingAnalytics');
jest.mock('../RecommendationEngine');

describe('Background Service Worker', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup storage mock
    mockedGet.mockImplementation((keys, callback) => {
      if (callback) {
        callback({});
      }
      return Promise.resolve({});
    });

    mockedSet.mockImplementation(() => Promise.resolve());

    mockedSyncGet.mockImplementation((keys, callback) => {
      if (callback) {
        callback({ userConfig: { tabLimit: 10 } });
      }
      return Promise.resolve({ userConfig: { tabLimit: 10 } });
    });

    mockedSyncSet.mockImplementation(() => Promise.resolve());

    // Setup tabs mock
    mockedTabsQuery.mockResolvedValue([]);
    mockedTabsCreate.mockResolvedValue({});
    mockedTabsRemove.mockResolvedValue(undefined);
    mockedTabsUpdate.mockResolvedValue({});

    // Setup notifications mock
    mockedNotificationsCreate.mockImplementation((options, callback) => {
      if (callback) {
        callback('notification-id');
      }
      return Promise.resolve('notification-id');
    });
  });

  test('should export manager instances', () => {
    expect(getTabManager()).toBeDefined();
    expect(getTabActivityTracker()).toBeDefined();
    expect(getTabSuggestionEngine()).toBeDefined();
    expect(getRecommendationEngine()).toBeDefined();
  });

  test('should initialize RecommendationEngine with TabActivityTracker and BrowsingAnalytics', () => {
    const recommendationEngine = getRecommendationEngine();
    expect(recommendationEngine).toBeDefined();
  });
});

// Test the message handlers for AI-powered recommendations
describe('AI-Powered Recommendations', () => {
  let mockMessageListener: (message: any, sender: any, sendResponse: any) => void;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Capture the message listener
    mockMessageListener = (chrome.runtime.onMessage as any).addListener.mock.calls[0][0];

    // Mock getRecommendationEngine
    const mockRecommendationEngine = getRecommendationEngine();

    // Properly set up mock functions
    mockRecommendationEngine.getOptimalTabLimit = jest.fn().mockResolvedValue({
      recommendedLimit: 8,
      currentLimit: 10,
      confidence: 0.8,
      reasoning: 'Based on your browsing patterns, a lower tab limit might improve your workflow.'
    });

    // Mock getFocusTimeRecommendations
    mockRecommendationEngine.getFocusTimeRecommendations = jest.fn().mockResolvedValue([
      {
        recommendedDuration: 25,
        recommendedStartTime: '10:00',
        category: 'focus',
        reasoning: 'Morning hours are typically your most productive time.'
      }
    ]);

    // Mock getPersonalizedRecommendations
    mockRecommendationEngine.getPersonalizedRecommendations = jest.fn().mockResolvedValue([
      {
        type: 'tab_limit',
        title: 'Adjust tab limit to 8',
        description: 'Based on your browsing patterns, a lower tab limit might improve your workflow.',
        actionable: true,
        action: {
          type: 'set_limit',
          value: 8
        }
      },
      {
        type: 'focus_time',
        title: 'Schedule a 25-minute focus session',
        description: 'Morning hours are typically your most productive time.',
        actionable: true,
        action: {
          type: 'start_focus',
          duration: 25
        }
      }
    ]);

    // Mock generateWeeklyReport
    mockRecommendationEngine.generateWeeklyReport = jest.fn().mockResolvedValue({
      startDate: '2025-07-10',
      endDate: '2025-07-16',
      productivityScore: 7.5,
      productivityTrend: 'increasing',
      topCategories: [
        { category: 'work', percentage: 60 },
        { category: 'social', percentage: 20 },
        { category: 'entertainment', percentage: 10 }
      ],
      focusMetrics: {
        focusScore: 8.0,
        longestFocusSession: 45,
        distractionCount: 12,
        averageFocusTime: 25
      },
      tabMetrics: {
        averageTabCount: 12,
        maxTabCount: 15,
        tabTurnover: 8
      },
      recommendations: [
        {
          type: 'tab_limit',
          title: 'Adjust tab limit to 8',
          description: 'Based on your browsing patterns, a lower tab limit might improve your workflow.',
          actionable: true,
          action: {
            type: 'set_limit',
            value: 8
          }
        }
      ],
      insights: [
        'Your productivity has been increasing this week. Keep up the good work!',
        'You spent most of your time (60%) on work websites.'
      ]
    });

    // Mock BrowsingAnalytics
    const mockBrowsingAnalytics = require('../BrowsingAnalytics').getBrowsingAnalytics();

    mockBrowsingAnalytics.getTodayInsights.mockResolvedValue({
      productivityScore: 7.5,
      timeDistribution: {
        'work': 3600000,
        'social': 1800000
      },
      focusMetrics: {
        focusScore: 8.0,
        longestFocusSession: 45,
        distractionCount: 12,
        averageFocusTime: 25
      },
      recommendations: [],
      categoryBreakdown: [
        {
          category: 'work',
          timeSpent: 3600000,
          tabCount: 5,
          percentage: 60
        },
        {
          category: 'social',
          timeSpent: 1800000,
          tabCount: 3,
          percentage: 30
        }
      ]
    });

    mockBrowsingAnalytics.getWeekInsights.mockResolvedValue({
      productivityScore: 7.2,
      timeDistribution: {
        'work': 18000000,
        'social': 9000000
      },
      focusMetrics: {
        focusScore: 7.5,
        longestFocusSession: 40,
        distractionCount: 60,
        averageFocusTime: 22
      },
      recommendations: [],
      categoryBreakdown: [
        {
          category: 'work',
          timeSpent: 18000000,
          tabCount: 25,
          percentage: 65
        },
        {
          category: 'social',
          timeSpent: 9000000,
          tabCount: 15,
          percentage: 25
        }
      ]
    });
  });

  test('should handle getProductivityInsights message with AI recommendations', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      { action: 'getProductivityInsights', period: 'today' },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    const response = sendResponse.mock.calls[0][0];

    expect(response.insights).toBeDefined();
    expect(response.insights.recommendations).toBeDefined();
    expect(response.insights.recommendations.length).toBeGreaterThan(0);
    expect(response.insights.tabLimitRecommendation).toBeDefined();
    expect(response.insights.focusRecommendations).toBeDefined();
    expect(response.trendData).toBeDefined();
  });

  test('should handle getOptimalTabLimit message', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      { action: 'getOptimalTabLimit' },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    const response = sendResponse.mock.calls[0][0];

    expect(response.recommendation).toBeDefined();
    expect(response.recommendation.recommendedLimit).toBe(8);
    expect(response.recommendation.currentLimit).toBe(10);
  });

  test('should handle getFocusTimeRecommendations message', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      { action: 'getFocusTimeRecommendations' },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    const response = sendResponse.mock.calls[0][0];

    expect(response.recommendations).toBeDefined();
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations[0].recommendedDuration).toBe(25);
  });

  test('should handle getPersonalizedRecommendations message', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      { action: 'getPersonalizedRecommendations' },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    const response = sendResponse.mock.calls[0][0];

    expect(response.recommendations).toBeDefined();
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations[0].type).toBe('tab_limit');
    expect(response.recommendations[0].actionable).toBe(true);
  });

  test('should handle generateWeeklyReport message', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      { action: 'generateWeeklyReport' },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    const response = sendResponse.mock.calls[0][0];

    expect(response.report).toBeDefined();
    expect(response.report.startDate).toBe('2025-07-10');
    expect(response.report.endDate).toBe('2025-07-16');
    expect(response.report.productivityScore).toBe(7.5);
    expect(response.report.insights.length).toBeGreaterThan(0);
  });

  test('should handle executeRecommendation message for tab limit', async () => {
    const sendResponse = jest.fn();

    mockedSyncGet.mockResolvedValue({
      userConfig: {
        tabLimit: 10,
        rules: []
      }
    });

    await mockMessageListener(
      {
        action: 'executeRecommendation',
        recommendationType: 'tab_limit',
        recommendationAction: {
          type: 'set_limit',
          value: 8
        }
      },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(mockedSyncSet).toHaveBeenCalledWith({
      userConfig: expect.objectContaining({
        tabLimit: 8
      })
    });
    expect(mockedNotificationsCreate).toHaveBeenCalled();
  });

  test('should handle executeRecommendation message for focus time', async () => {
    const sendResponse = jest.fn();

    await mockMessageListener(
      {
        action: 'executeRecommendation',
        recommendationType: 'focus_time',
        recommendationAction: {
          type: 'start_focus',
          duration: 25
        }
      },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(mockedNotificationsCreate).toHaveBeenCalled();
  });
});