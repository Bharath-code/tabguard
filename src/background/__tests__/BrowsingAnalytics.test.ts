/**
 * Tests for BrowsingAnalytics
 */

import { BrowsingAnalytics } from '../BrowsingAnalytics';
import { TabActivityTracker } from '../TabActivityTracker';
import { WebsiteCategory } from '../../shared/types';

// Mock chrome API
global.chrome = {
    tabs: {
        query: jest.fn()
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
} as any;

// Properly type the mocked functions
const mockedGet = chrome.storage.local.get as jest.Mock;
const mockedSet = chrome.storage.local.set as jest.Mock;

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');

describe('BrowsingAnalytics', () => {
    let analytics: BrowsingAnalytics;
    let mockActivityTracker: jest.Mocked<TabActivityTracker>;

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

        // Setup activity tracker mock
        mockActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;

        // Mock exportActivityData
        mockActivityTracker.exportActivityData.mockReturnValue([
            {
                tabId: 1,
                url: 'https://github.com/example/repo',
                title: 'GitHub - Example Repo',
                domain: 'github.com',
                category: 'work' as WebsiteCategory,
                totalActiveTime: 1800000, // 30 minutes
                memoryUsage: 120000 // 120MB
            },
            {
                tabId: 2,
                url: 'https://facebook.com/profile',
                title: 'Facebook',
                domain: 'facebook.com',
                category: 'social' as WebsiteCategory,
                totalActiveTime: 600000, // 10 minutes
                memoryUsage: 80000 // 80MB
            },
            {
                tabId: 3,
                url: 'https://docs.google.com/document',
                title: 'Google Docs',
                domain: 'docs.google.com',
                category: 'work' as WebsiteCategory,
                totalActiveTime: 1200000, // 20 minutes
                memoryUsage: 100000 // 100MB
            }
        ]);

        // Mock getActivitySummary
        mockActivityTracker.getActivitySummary.mockReturnValue({
            totalTabs: 3,
            activeTabs: 1,
            inactiveTabs: 2,
            oldestTab: null,
            newestTab: null,
            mostActiveTab: null,
            leastActiveTab: null,
            averageTabAge: 3600000, // 1 hour
            averageActiveTime: 1200000, // 20 minutes
            totalMemoryUsage: 300000 // 300MB
        });

        // Create analytics instance with test options
        analytics = new BrowsingAnalytics(mockActivityTracker, {
            collectDetailedData: true,
            anonymizeUrls: false,
            dataRetentionDays: 7,
            analysisInterval: 0.1 // 6 minutes for faster testing
        });

        // Mock setTimeout to execute immediately
        jest.useFakeTimers();
    });

    afterEach(() => {
        analytics.cleanup();
        jest.useRealTimers();
    });

    test('should initialize with default category details', () => {
        const categoryDetails = analytics.getCategoryDetails();
        expect(categoryDetails).toHaveLength(6); // work, social, entertainment, news, shopping, other

        const workCategory = categoryDetails.find(c => c.category === 'work');
        expect(workCategory).toBeDefined();
        expect(workCategory?.productivityScore).toBe(9);
        expect(workCategory?.patterns).toContain('github.com');

        const socialCategory = categoryDetails.find(c => c.category === 'social');
        expect(socialCategory).toBeDefined();
        expect(socialCategory?.productivityScore).toBe(2);
        expect(socialCategory?.patterns).toContain('facebook.com');
    });

    test('should categorize websites correctly', () => {
        expect(analytics.categorizeWebsite('https://github.com/user/repo')).toBe('work');
        expect(analytics.categorizeWebsite('https://facebook.com/profile')).toBe('social');
        expect(analytics.categorizeWebsite('https://youtube.com/watch')).toBe('entertainment');
        expect(analytics.categorizeWebsite('https://nytimes.com/article')).toBe('news');
        expect(analytics.categorizeWebsite('https://amazon.com/product')).toBe('shopping');
        expect(analytics.categorizeWebsite('https://example.com')).toBe('other');
    });

    test('should create session from current activity', async () => {
        const session = await analytics.createSessionFromCurrentActivity();

        expect(session).not.toBeNull();
        expect(session?.tabs).toHaveLength(3);
        expect(session?.productivityScore).toBeGreaterThan(0);

        // Check that the session contains the expected data
        expect(session?.tabs[0].category).toBe('work');
        expect(session?.tabs[1].category).toBe('social');

        // Verify that storage was called to save the data
        expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should generate today insights', async () => {
        // First create some data
        await analytics.createSessionFromCurrentActivity();

        const insights = await analytics.getTodayInsights();

        expect(insights).toBeDefined();
        expect(insights.productivityScore).toBeGreaterThan(0);
        expect(insights.recommendations.length).toBeGreaterThan(0);
        expect(insights.timeDistribution).toBeDefined();
        expect(insights.focusMetrics).toBeDefined();
    });

    test('should generate week insights', async () => {
        // First create some data
        await analytics.createSessionFromCurrentActivity();

        const insights = await analytics.getWeekInsights();

        expect(insights).toBeDefined();
        expect(insights.productivityScore).toBeGreaterThan(0);
        expect(insights.recommendations.length).toBeGreaterThan(0);
        expect(insights.timeDistribution).toBeDefined();
        expect(insights.focusMetrics).toBeDefined();
    });

    test('should update category details', () => {
        const newWorkCategory = {
            category: 'work' as WebsiteCategory,
            productivityScore: 10,
            patterns: ['github.com', 'gitlab.com', 'custom-work-site.com'],
            color: '#00FF00'
        };

        analytics.updateCategoryDetails(newWorkCategory);

        const updatedCategories = analytics.getCategoryDetails();
        const updatedWorkCategory = updatedCategories.find(c => c.category === 'work');

        expect(updatedWorkCategory).toBeDefined();
        expect(updatedWorkCategory?.productivityScore).toBe(10);
        expect(updatedWorkCategory?.patterns).toContain('custom-work-site.com');
        expect(updatedWorkCategory?.color).toBe('#00FF00');
    });

    test('should analyze browsing data periodically', async () => {
        // Mock createSessionFromCurrentActivity
        const createSessionSpy = jest.spyOn(analytics, 'createSessionFromCurrentActivity');

        // Fast-forward timers
        jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

        expect(createSessionSpy).toHaveBeenCalled();
    });

    test('should generate date range insights', async () => {
        // First create some data
        await analytics.createSessionFromCurrentActivity();

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);

        const endDate = new Date();

        const insights = await analytics.getDateRangeInsights(startDate, endDate);

        expect(insights).toBeDefined();
        expect(insights.productivityScore).toBeGreaterThan(0);
        expect(insights.recommendations.length).toBeGreaterThan(0);
        expect(insights.timeDistribution).toBeDefined();
        expect(insights.focusMetrics).toBeDefined();
    });
});