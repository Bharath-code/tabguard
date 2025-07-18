/**
 * BrowsingAnalytics for TabGuard Pro
 * 
 * Collects and analyzes browsing data to provide productivity insights
 * and personalized recommendations.
 * 
 * Implements requirements:
 * - 3.1: Display daily/weekly productivity metrics
 * - 3.2: Categorize websites by productivity level
 * - 9.2: Anonymize personal data for AI processing
 */

import { TabActivityTracker, TabActivityData } from './TabActivityTracker';
import {
    BrowsingSession,
    TabActivity,
    WebsiteCategory,
    MemoryMetrics,
    ProductivityInsights,
    WebsiteCategoryDetails
} from '../shared/types';

export interface BrowsingAnalyticsOptions {
    // Whether to collect detailed browsing data
    collectDetailedData: boolean;

    // Whether to anonymize URLs for privacy
    anonymizeUrls: boolean;

    // How long to keep browsing history (in days)
    dataRetentionDays: number;

    // How often to analyze browsing patterns (in hours)
    analysisInterval: number;
}

export interface CategoryBreakdown {
    category: WebsiteCategory;
    timeSpent: number; // milliseconds
    tabCount: number;
    percentage: number;
}

export interface DailyProductivityData {
    date: string; // YYYY-MM-DD format
    productivityScore: number; // 0-100
    totalActiveTime: number; // milliseconds
    tabsOpened: number;
    tabsClosed: number;
    categoryBreakdown: CategoryBreakdown[];
    memoryUsage: MemoryMetrics;
}

export interface WeeklyProductivityData {
    startDate: string; // YYYY-MM-DD format
    endDate: string; // YYYY-MM-DD format
    averageProductivityScore: number; // 0-100
    dailyScores: { [date: string]: number };
    totalActiveTime: number; // milliseconds
    averageTabsPerDay: number;
    categoryBreakdown: CategoryBreakdown[];
    memoryUsage: MemoryMetrics;
    productivityTrend: 'increasing' | 'decreasing' | 'stable';
}

export class BrowsingAnalytics {
    private activityTracker: TabActivityTracker;
    private sessions: BrowsingSession[] = [];
    private dailyData: { [date: string]: DailyProductivityData } = {};
    private weeklyData: WeeklyProductivityData[] = [];
    private categoryDetails: Map<string, WebsiteCategoryDetails> = new Map();
    private analysisIntervalId: number | null = null;

    private options: BrowsingAnalyticsOptions = {
        collectDetailedData: false,
        anonymizeUrls: true,
        dataRetentionDays: 30,
        analysisInterval: 1 // 1 hour
    };

    constructor(activityTracker: TabActivityTracker, options?: Partial<BrowsingAnalyticsOptions>) {
        this.activityTracker = activityTracker;

        // Apply custom options
        if (options) {
            this.options = { ...this.options, ...options };
        }

        // Initialize category details with default values
        this.initializeCategoryDetails();

        // Load saved data
        this.loadSavedData();

        // Start periodic analysis
        this.startPeriodicAnalysis();
    }

    /**
     * Initialize category details with default productivity values and patterns
     */
    private initializeCategoryDetails(): void {
        // Work category
        this.categoryDetails.set('work', {
            category: 'work',
            productivityScore: 9,
            patterns: [
                'github.com', 'gitlab.com', 'stackoverflow.com', 'docs.',
                'jira.', 'confluence.', 'notion.so', 'trello.com',
                'asana.com', 'slack.com', 'teams.microsoft.com',
                'meet.google.com', 'zoom.us', 'atlassian.com',
                'office.com', 'sharepoint.com', 'figma.com'
            ],
            color: '#4CAF50' // Green
        });

        // News category
        this.categoryDetails.set('news', {
            category: 'news',
            productivityScore: 6,
            patterns: [
                'news.', '.news', 'nytimes.com', 'washingtonpost.com',
                'bbc.', 'cnn.com', 'reuters.com', 'bloomberg.com',
                'wsj.com', 'economist.com', 'apnews.com', 'npr.org',
                'theguardian.com', 'ft.com'
            ],
            color: '#2196F3' // Blue
        });

        // Shopping category
        this.categoryDetails.set('shopping', {
            category: 'shopping',
            productivityScore: 3,
            patterns: [
                'amazon.', 'ebay.', 'walmart.com', 'target.com',
                'etsy.com', 'shop.', 'store.', 'shopping.',
                'bestbuy.com', 'newegg.com', 'wayfair.com',
                'homedepot.com', 'lowes.com', 'aliexpress.com'
            ],
            color: '#FF9800' // Orange
        });

        // Social category
        this.categoryDetails.set('social', {
            category: 'social',
            productivityScore: 2,
            patterns: [
                'facebook.com', 'twitter.com', 'instagram.com',
                'linkedin.com', 'reddit.com', 'tiktok.com',
                'pinterest.com', 'snapchat.com', 'whatsapp.com',
                'discord.com', 'telegram.org', 'messenger.com'
            ],
            color: '#E91E63' // Pink
        });

        // Entertainment category
        this.categoryDetails.set('entertainment', {
            category: 'entertainment',
            productivityScore: 1,
            patterns: [
                'youtube.com', 'netflix.com', 'hulu.com', 'disney',
                'spotify.com', 'twitch.tv', 'vimeo.com', 'hbomax.com',
                'primevideo.com', 'soundcloud.com', 'pandora.com',
                'tidal.com', 'deezer.com', 'apple.com/tv'
            ],
            color: '#9C27B0' // Purple
        });

        // Other category
        this.categoryDetails.set('other', {
            category: 'other',
            productivityScore: 5,
            patterns: [],
            color: '#9E9E9E' // Gray
        });
    }

    /**
     * Load saved analytics data from storage
     */
    private async loadSavedData(): Promise<void> {
        try {
            const data = await chrome.storage.local.get([
                'browsingAnalytics_sessions',
                'browsingAnalytics_dailyData',
                'browsingAnalytics_weeklyData'
            ]);

            if (data.browsingAnalytics_sessions) {
                this.sessions = JSON.parse(data.browsingAnalytics_sessions);

                // Convert date strings back to Date objects
                this.sessions.forEach(session => {
                    session.startTime = new Date(session.startTime);
                    session.endTime = new Date(session.endTime);
                    // TabActivity doesn't have lastAccessed property, so we don't need to convert it
                });
            }

            if (data.browsingAnalytics_dailyData) {
                this.dailyData = JSON.parse(data.browsingAnalytics_dailyData);
            }

            if (data.browsingAnalytics_weeklyData) {
                this.weeklyData = JSON.parse(data.browsingAnalytics_weeklyData);
            }

            // Clean up old data
            this.cleanupOldData();

        } catch (error) {
            console.error('Error loading browsing analytics data:', error);
            // Initialize with empty data
            this.sessions = [];
            this.dailyData = {};
            this.weeklyData = [];
        }
    }

    /**
     * Save analytics data to storage
     */
    private async saveData(): Promise<void> {
        try {
            await chrome.storage.local.set({
                'browsingAnalytics_sessions': JSON.stringify(this.sessions),
                'browsingAnalytics_dailyData': JSON.stringify(this.dailyData),
                'browsingAnalytics_weeklyData': JSON.stringify(this.weeklyData)
            });
        } catch (error) {
            console.error('Error saving browsing analytics data:', error);
        }
    }

    /**
     * Start periodic analysis of browsing data
     */
    private startPeriodicAnalysis(): void {
        // Clear existing interval if any
        if (this.analysisIntervalId !== null) {
            clearTimeout(this.analysisIntervalId);
            this.analysisIntervalId = null;
        }

        // Use a recursive setTimeout pattern which is more reliable in service workers
        const scheduleNextAnalysis = () => {
            this.analysisIntervalId = setTimeout(async () => {
                await this.analyzeBrowsingData();
                // Schedule next analysis if still active
                if (this.analysisIntervalId !== null) {
                    scheduleNextAnalysis();
                }
            }, this.options.analysisInterval * 60 * 60 * 1000) as unknown as number;
        };

        // Start the first analysis cycle
        scheduleNextAnalysis();
    }

    /**
     * Stop periodic analysis
     */
    stopPeriodicAnalysis(): void {
        if (this.analysisIntervalId !== null) {
            clearTimeout(this.analysisIntervalId);
            this.analysisIntervalId = null;
        }
    }

    /**
     * Create a new browsing session from current tab activity
     */
    async createSessionFromCurrentActivity(): Promise<BrowsingSession | null> {
        try {
            // Get activity data from tracker
            const activityData = this.activityTracker.exportActivityData();
            const activitySummary = this.activityTracker.getActivitySummary();

            if (activityData.length === 0) {
                return null;
            }

            // Create tab activity records
            const tabActivities: TabActivity[] = [];

            for (const data of activityData) {
                // Skip entries without necessary data
                if (!data.category || data.totalActiveTime === undefined || data.memoryUsage === undefined) {
                    continue;
                }

                const tabActivity: TabActivity = {
                    tabId: data.tabId || 0,
                    url: this.anonymizeUrl(data.url || ''),
                    title: this.anonymizeTitle(data.title || ''),
                    timeActive: data.totalActiveTime || 0,
                    category: data.category,
                    memoryUsage: data.memoryUsage || 0
                };

                tabActivities.push(tabActivity);
            }

            // Calculate productivity score
            const productivityScore = this.calculateProductivityScore(tabActivities);

            // Create memory metrics
            const memoryMetrics: MemoryMetrics = {
                totalMemory: activitySummary.totalMemoryUsage,
                usedMemory: activitySummary.totalMemoryUsage,
                savedMemory: 0 // Will be calculated later based on historical data
            };

            // Create session
            const session: BrowsingSession = {
                sessionId: this.generateSessionId(),
                startTime: new Date(Date.now() - 3600000), // Assume session started 1 hour ago
                endTime: new Date(),
                tabs: tabActivities,
                productivityScore,
                memoryUsage: memoryMetrics
            };

            // Add to sessions list
            this.sessions.push(session);

            // Update daily and weekly data
            await this.updateDailyData(session);
            await this.updateWeeklyData();

            // Save data
            await this.saveData();

            return session;
        } catch (error) {
            console.error('Error creating browsing session:', error);
            return null;
        }
    }

    /**
     * Analyze browsing data to generate insights
     */
    async analyzeBrowsingData(): Promise<void> {
        try {
            // Create a new session from current activity
            await this.createSessionFromCurrentActivity();

            // Clean up old data
            this.cleanupOldData();

            // Save updated data
            await this.saveData();
        } catch (error) {
            console.error('Error analyzing browsing data:', error);
        }
    }

    /**
     * Get productivity insights for the current day
     */
    async getTodayInsights(): Promise<ProductivityInsights> {
        const today = this.getDateString(new Date());
        const todayData = this.dailyData[today];

        if (!todayData) {
            // No data for today yet, create a session and analyze
            await this.analyzeBrowsingData();
            return this.generateInsightsFromDailyData(this.dailyData[today] || this.createEmptyDailyData(new Date()));
        }

        return this.generateInsightsFromDailyData(todayData);
    }

    /**
     * Get productivity insights for the current week
     */
    async getWeekInsights(): Promise<ProductivityInsights> {
        // Find the current week's data
        const now = new Date();
        const currentWeekData = this.findCurrentWeekData(now);

        if (!currentWeekData) {
            // No data for current week, analyze data first
            await this.analyzeBrowsingData();
            return this.generateInsightsFromWeeklyData(
                this.findCurrentWeekData(now) || this.createEmptyWeeklyData(now)
            );
        }

        return this.generateInsightsFromWeeklyData(currentWeekData);
    }

    /**
     * Get productivity insights for a specific date range
     */
    async getDateRangeInsights(startDate: Date, endDate: Date): Promise<ProductivityInsights> {
        // Ensure we have up-to-date data
        await this.analyzeBrowsingData();

        // Filter sessions within the date range
        const relevantSessions = this.sessions.filter(session => {
            return session.startTime >= startDate && session.endTime <= endDate;
        });

        // Calculate aggregate metrics
        let totalActiveTime = 0;
        let totalTabs = 0;
        let weightedProductivityScore = 0;

        const categoryTimeMap: { [category: string]: number } = {};

        for (const session of relevantSessions) {
            for (const tab of session.tabs) {
                totalActiveTime += tab.timeActive;
                totalTabs++;

                // Add to category time
                if (!categoryTimeMap[tab.category]) {
                    categoryTimeMap[tab.category] = 0;
                }
                categoryTimeMap[tab.category] += tab.timeActive;

                // Add weighted productivity score
                const categoryScore = this.getCategoryProductivityScore(tab.category);
                weightedProductivityScore += categoryScore * tab.timeActive;
            }
        }

        // Calculate overall productivity score
        const productivityScore = totalActiveTime > 0
            ? Math.round((weightedProductivityScore / totalActiveTime) * 10)
            : 5;

        // Generate category breakdown
        const categoryBreakdown: CategoryBreakdown[] = [];

        for (const [category, timeSpent] of Object.entries(categoryTimeMap)) {
            categoryBreakdown.push({
                category: category as WebsiteCategory,
                timeSpent,
                tabCount: relevantSessions.flatMap(s => s.tabs).filter(t => t.category === category).length,
                percentage: totalActiveTime > 0 ? (timeSpent / totalActiveTime) * 100 : 0
            });
        }

        // Sort by time spent (descending)
        categoryBreakdown.sort((a, b) => b.timeSpent - a.timeSpent);

        // Generate recommendations based on the data
        const recommendations = this.generateRecommendations(
            productivityScore,
            categoryBreakdown,
            totalTabs,
            totalActiveTime
        );

        return {
            productivityScore,
            timeDistribution: categoryTimeMap,
            focusMetrics: {
                focusScore: this.calculateFocusScore(relevantSessions),
                longestFocusSession: this.calculateLongestFocusSession(relevantSessions),
                distractionCount: this.calculateDistractionCount(relevantSessions),
                averageFocusTime: this.calculateAverageFocusTime(relevantSessions)
            },
            recommendations,
            categoryBreakdown
        };
    }

    /**
     * Get website categorization details
     */
    getCategoryDetails(): WebsiteCategoryDetails[] {
        return Array.from(this.categoryDetails.values());
    }

    /**
     * Update website categorization details
     */
    updateCategoryDetails(details: WebsiteCategoryDetails): void {
        this.categoryDetails.set(details.category, details);
    }

    /**
     * Categorize a website based on its URL
     */
    categorizeWebsite(url: string): WebsiteCategory {
        try {
            const domain = this.extractDomain(url).toLowerCase();

            // Check each category's patterns
            for (const [category, details] of this.categoryDetails.entries()) {
                if (category === 'other') continue; // Skip the "other" category

                for (const pattern of details.patterns) {
                    if (domain.includes(pattern.toLowerCase())) {
                        return details.category;
                    }
                }
            }

            // Default to "other" if no match found
            return 'other';
        } catch (error) {
            console.error('Error categorizing website:', error);
            return 'other';
        }
    }

    /**
     * Calculate productivity score for a list of tab activities
     */
    private calculateProductivityScore(tabs: TabActivity[]): number {
        if (tabs.length === 0) {
            return 5; // Default middle score
        }

        let totalActiveTime = 0;
        let weightedProductivityScore = 0;

        for (const tab of tabs) {
            totalActiveTime += tab.timeActive;
            const categoryScore = this.getCategoryProductivityScore(tab.category);
            weightedProductivityScore += categoryScore * tab.timeActive;
        }

        // Calculate weighted average (0-10 scale)
        return totalActiveTime > 0
            ? Math.round((weightedProductivityScore / totalActiveTime) * 10) / 10
            : 5;
    }

    /**
     * Get productivity score for a website category (0-10 scale)
     */
    private getCategoryProductivityScore(category: WebsiteCategory): number {
        const details = this.categoryDetails.get(category);
        return details ? details.productivityScore : 5;
    }

    /**
     * Update daily productivity data with a new session
     */
    private async updateDailyData(session: BrowsingSession): Promise<void> {
        const dateString = this.getDateString(session.endTime);

        // Get or create daily data for this date
        let dailyData = this.dailyData[dateString];
        if (!dailyData) {
            dailyData = this.createEmptyDailyData(session.endTime);
            this.dailyData[dateString] = dailyData;
        }

        // Update metrics
        dailyData.totalActiveTime += session.tabs.reduce((sum, tab) => sum + tab.timeActive, 0);
        dailyData.tabsOpened += session.tabs.length;

        // Update category breakdown
        const categoryTimeMap: { [category: string]: number } = {};

        for (const tab of session.tabs) {
            if (!categoryTimeMap[tab.category]) {
                categoryTimeMap[tab.category] = 0;
            }
            categoryTimeMap[tab.category] += tab.timeActive;
        }

        // Update or create category breakdown entries
        for (const [category, timeSpent] of Object.entries(categoryTimeMap)) {
            const existingCategory = dailyData.categoryBreakdown.find(c => c.category === category);

            if (existingCategory) {
                existingCategory.timeSpent += timeSpent;
                existingCategory.tabCount += session.tabs.filter(t => t.category === category).length;
            } else {
                dailyData.categoryBreakdown.push({
                    category: category as WebsiteCategory,
                    timeSpent,
                    tabCount: session.tabs.filter(t => t.category === category).length,
                    percentage: 0 // Will be recalculated below
                });
            }
        }

        // Recalculate percentages
        if (dailyData.totalActiveTime > 0) {
            for (const category of dailyData.categoryBreakdown) {
                category.percentage = (category.timeSpent / dailyData.totalActiveTime) * 100;
            }
        }

        // Sort by time spent (descending)
        dailyData.categoryBreakdown.sort((a, b) => b.timeSpent - a.timeSpent);

        // Update productivity score
        dailyData.productivityScore = this.calculateProductivityScore(session.tabs);

        // Update memory usage
        dailyData.memoryUsage.totalMemory += session.memoryUsage.totalMemory;
        dailyData.memoryUsage.usedMemory += session.memoryUsage.usedMemory;
        dailyData.memoryUsage.savedMemory += session.memoryUsage.savedMemory;
    }

    /**
     * Update weekly productivity data
     */
    private async updateWeeklyData(): Promise<void> {
        // Get dates for the current week (Sunday to Saturday)
        const now = new Date();
        const currentWeekStart = this.getStartOfWeek(now);
        const currentWeekEnd = this.getEndOfWeek(now);

        // Format dates as strings
        const startDateString = this.getDateString(currentWeekStart);
        const endDateString = this.getDateString(currentWeekEnd);

        // Find or create weekly data for current week
        let weeklyData = this.weeklyData.find(w =>
            w.startDate === startDateString && w.endDate === endDateString
        );

        if (!weeklyData) {
            weeklyData = {
                startDate: startDateString,
                endDate: endDateString,
                averageProductivityScore: 0,
                dailyScores: {},
                totalActiveTime: 0,
                averageTabsPerDay: 0,
                categoryBreakdown: [],
                memoryUsage: {
                    totalMemory: 0,
                    usedMemory: 0,
                    savedMemory: 0
                },
                productivityTrend: 'stable'
            };

            this.weeklyData.push(weeklyData);
        }

        // Collect daily data for the current week
        let totalScore = 0;
        let daysWithData = 0;
        let totalTabs = 0;
        const categoryTimeMap: { [category: string]: number } = {};

        // Iterate through each day of the week
        for (let d = new Date(currentWeekStart); d <= currentWeekEnd; d.setDate(d.getDate() + 1)) {
            const dateString = this.getDateString(d);
            const dailyData = this.dailyData[dateString];

            if (dailyData) {
                // Add to weekly totals
                totalScore += dailyData.productivityScore;
                daysWithData++;
                totalTabs += dailyData.tabsOpened;
                weeklyData.totalActiveTime += dailyData.totalActiveTime;
                weeklyData.dailyScores[dateString] = dailyData.productivityScore;

                // Add to memory usage
                weeklyData.memoryUsage.totalMemory += dailyData.memoryUsage.totalMemory;
                weeklyData.memoryUsage.usedMemory += dailyData.memoryUsage.usedMemory;
                weeklyData.memoryUsage.savedMemory += dailyData.memoryUsage.savedMemory;

                // Add to category breakdown
                for (const category of dailyData.categoryBreakdown) {
                    if (!categoryTimeMap[category.category]) {
                        categoryTimeMap[category.category] = 0;
                    }
                    categoryTimeMap[category.category] += category.timeSpent;
                }
            }
        }

        // Calculate averages
        weeklyData.averageProductivityScore = daysWithData > 0 ? totalScore / daysWithData : 0;
        weeklyData.averageTabsPerDay = daysWithData > 0 ? totalTabs / daysWithData : 0;

        // Create category breakdown
        weeklyData.categoryBreakdown = [];
        for (const [category, timeSpent] of Object.entries(categoryTimeMap)) {
            weeklyData.categoryBreakdown.push({
                category: category as WebsiteCategory,
                timeSpent,
                tabCount: 0, // We don't track this at the weekly level
                percentage: weeklyData.totalActiveTime > 0
                    ? (timeSpent / weeklyData.totalActiveTime) * 100
                    : 0
            });
        }

        // Sort by time spent (descending)
        weeklyData.categoryBreakdown.sort((a, b) => b.timeSpent - a.timeSpent);

        // Calculate productivity trend
        weeklyData.productivityTrend = this.calculateProductivityTrend(weeklyData);
    }

    /**
     * Calculate productivity trend based on daily scores
     */
    private calculateProductivityTrend(weeklyData: WeeklyProductivityData): 'increasing' | 'decreasing' | 'stable' {
        const dailyScores = Object.entries(weeklyData.dailyScores)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([_, score]) => score);

        if (dailyScores.length < 2) {
            return 'stable';
        }

        // Calculate linear regression slope
        const n = dailyScores.length;
        const indices = Array.from({ length: n }, (_, i) => i);

        const sumX = indices.reduce((sum, x) => sum + x, 0);
        const sumY = dailyScores.reduce((sum, y) => sum + y, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * dailyScores[i], 0);
        const sumXX = indices.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        // Determine trend based on slope
        if (slope > 0.1) {
            return 'increasing';
        } else if (slope < -0.1) {
            return 'decreasing';
        } else {
            return 'stable';
        }
    }

    /**
     * Generate insights from daily productivity data
     */
    private generateInsightsFromDailyData(dailyData: DailyProductivityData): ProductivityInsights {
        // Generate recommendations based on the data
        const recommendations = this.generateRecommendations(
            dailyData.productivityScore,
            dailyData.categoryBreakdown,
            dailyData.tabsOpened,
            dailyData.totalActiveTime
        );

        // Calculate focus metrics from sessions on this day
        const dateString = dailyData.date;
        const dayStart = new Date(dateString);
        const dayEnd = new Date(dateString);
        dayEnd.setHours(23, 59, 59, 999);

        const daySessions = this.sessions.filter(session =>
            session.startTime >= dayStart && session.endTime <= dayEnd
        );

        return {
            productivityScore: dailyData.productivityScore,
            timeDistribution: dailyData.categoryBreakdown.reduce((map, category) => {
                map[category.category] = category.timeSpent;
                return map;
            }, {} as { [category: string]: number }),
            focusMetrics: {
                focusScore: this.calculateFocusScore(daySessions),
                longestFocusSession: this.calculateLongestFocusSession(daySessions),
                distractionCount: this.calculateDistractionCount(daySessions),
                averageFocusTime: this.calculateAverageFocusTime(daySessions)
            },
            recommendations,
            categoryBreakdown: dailyData.categoryBreakdown
        };
    }

    /**
     * Generate insights from weekly productivity data
     */
    private generateInsightsFromWeeklyData(weeklyData: WeeklyProductivityData): ProductivityInsights {
        // Generate recommendations based on the data
        const recommendations = this.generateRecommendations(
            weeklyData.averageProductivityScore,
            weeklyData.categoryBreakdown,
            weeklyData.averageTabsPerDay * 7, // Approximate total tabs for the week
            weeklyData.totalActiveTime
        );

        // Calculate focus metrics from sessions in this week
        const weekStart = new Date(weeklyData.startDate);
        const weekEnd = new Date(weeklyData.endDate);
        weekEnd.setHours(23, 59, 59, 999);

        const weekSessions = this.sessions.filter(session =>
            session.startTime >= weekStart && session.endTime <= weekEnd
        );

        return {
            productivityScore: weeklyData.averageProductivityScore,
            timeDistribution: weeklyData.categoryBreakdown.reduce((map, category) => {
                map[category.category] = category.timeSpent;
                return map;
            }, {} as { [category: string]: number }),
            focusMetrics: {
                focusScore: this.calculateFocusScore(weekSessions),
                longestFocusSession: this.calculateLongestFocusSession(weekSessions),
                distractionCount: this.calculateDistractionCount(weekSessions),
                averageFocusTime: this.calculateAverageFocusTime(weekSessions)
            },
            recommendations,
            categoryBreakdown: weeklyData.categoryBreakdown
        };
    }

    /**
     * Generate personalized recommendations based on productivity data
     */
    private generateRecommendations(
        productivityScore: number,
        categoryBreakdown: CategoryBreakdown[],
        tabCount: number,
        activeTime: number
    ): string[] {
        const recommendations: string[] = [];

        // Recommendation based on productivity score
        if (productivityScore < 4) {
            recommendations.push(
                "Your productivity score is low. Consider using focus mode to block distracting websites."
            );
        } else if (productivityScore > 7) {
            recommendations.push(
                "Great productivity score! Keep up the good work."
            );
        }
        
        // Get optimal tab limit recommendation
        if (tabCount > 10) {
            const optimalTabCount = Math.max(5, Math.round(tabCount * 0.7));
            recommendations.push(
                `Consider reducing your tab limit to around ${optimalTabCount} tabs for better focus and performance.`
            );
        }
        
        // Focus time recommendations
        const workCategory = categoryBreakdown.find(c => c.category === 'work');
        const socialCategory = categoryBreakdown.find(c => c.category === 'social');
        const entertainmentCategory = categoryBreakdown.find(c => c.category === 'entertainment');
        
        if (workCategory && workCategory.percentage < 30 && activeTime > 3600000) {
            recommendations.push(
                "Try scheduling dedicated focus time blocks to increase work-related productivity."
            );
        }
        
        // Break recommendations
        if (activeTime > 5400000) { // 1.5 hours
            recommendations.push(
                "You've been browsing for over 90 minutes. Consider taking a short break to refresh your focus."
            );
        }
        
        // Category-specific recommendations
        if (socialCategory && socialCategory.percentage > 30) {
            recommendations.push(
                `You're spending ${Math.round(socialCategory.percentage)}% of your time on social media. Consider setting time limits for these sites.`
            );
        }
        
        if (entertainmentCategory && entertainmentCategory.percentage > 25) {
            recommendations.push(
                `Entertainment sites are taking up ${Math.round(entertainmentCategory.percentage)}% of your browsing time. Try scheduling specific times for entertainment browsing.`
            );
        }

        // Recommendation based on category breakdown
        const distractingCategories = ['social', 'entertainment'];
        const distractingTime = categoryBreakdown
            .filter(c => distractingCategories.includes(c.category))
            .reduce((sum, c) => sum + c.timeSpent, 0);

        const distractingPercentage = activeTime > 0 ? (distractingTime / activeTime) * 100 : 0;

        if (distractingPercentage > 40) {
            recommendations.push(
                `You're spending ${Math.round(distractingPercentage)}% of your time on distracting websites. Consider setting stricter limits.`
            );
        }

        // Recommendation based on tab count
        if (tabCount > 20) {
            recommendations.push(
                `You opened ${tabCount} tabs. Consider reducing your tab limit to improve focus and performance.`
            );
        }

        // Add a time management recommendation
        if (activeTime > 4 * 60 * 60 * 1000) { // More than 4 hours
            recommendations.push(
                "You've been browsing for a long time. Remember to take regular breaks to maintain productivity."
            );
        }

        return recommendations;
    }

    /**
     * Calculate focus score from sessions (0-10 scale)
     */
    private calculateFocusScore(sessions: BrowsingSession[]): number {
        if (sessions.length === 0) {
            return 5; // Default middle score
        }

        // Calculate based on:
        // 1. Ratio of productive to unproductive time
        // 2. Number of context switches (tab changes)
        // 3. Average session duration

        let productiveTime = 0;
        let totalTime = 0;
        let contextSwitches = 0;

        for (const session of sessions) {
            for (const tab of session.tabs) {
                totalTime += tab.timeActive;

                // Count time in productive categories
                if (['work', 'news'].includes(tab.category)) {
                    productiveTime += tab.timeActive;
                }

                // Each tab activation counts as a context switch
                contextSwitches++;
            }
        }

        // Calculate productive time ratio (0-1)
        const productiveRatio = totalTime > 0 ? productiveTime / totalTime : 0.5;

        // Calculate context switch penalty (0-1, lower is better)
        const hourlyContextSwitches = totalTime > 0
            ? (contextSwitches / (totalTime / (60 * 60 * 1000)))
            : 10;
        const contextSwitchPenalty = Math.min(1, hourlyContextSwitches / 30);

        // Calculate average session duration bonus (0-1, higher is better)
        const avgSessionDuration = sessions.length > 0
            ? totalTime / sessions.length
            : 0;
        const sessionDurationBonus = Math.min(1, avgSessionDuration / (30 * 60 * 1000));

        // Combine factors into focus score (0-10)
        const focusScore = (
            (productiveRatio * 5) +
            ((1 - contextSwitchPenalty) * 3) +
            (sessionDurationBonus * 2)
        );

        return Math.round(focusScore * 10) / 10;
    }

    /**
     * Calculate longest focus session duration in minutes
     */
    private calculateLongestFocusSession(sessions: BrowsingSession[]): number {
        if (sessions.length === 0) {
            return 0;
        }

        // Find the longest continuous period on productive websites
        let longestSession = 0;

        for (const session of sessions) {
            // Group tabs by time periods
            const productiveTabs = session.tabs
                .filter(tab => ['work', 'news'].includes(tab.category))
                .sort((a, b) => a.tabId - b.tabId); // Sort by ID as a proxy for time

            if (productiveTabs.length > 0) {
                let currentSessionLength = productiveTabs[0].timeActive;
                let maxSessionLength = currentSessionLength;

                for (let i = 1; i < productiveTabs.length; i++) {
                    // If tabs are likely part of the same session, add their times
                    if (productiveTabs[i].tabId - productiveTabs[i - 1].tabId < 3) {
                        currentSessionLength += productiveTabs[i].timeActive;
                    } else {
                        // Reset for new session
                        currentSessionLength = productiveTabs[i].timeActive;
                    }

                    maxSessionLength = Math.max(maxSessionLength, currentSessionLength);
                }

                longestSession = Math.max(longestSession, maxSessionLength);
            }
        }

        // Convert to minutes
        return Math.round(longestSession / (60 * 1000));
    }

    /**
     * Calculate number of distractions (switches to unproductive sites)
     */
    private calculateDistractionCount(sessions: BrowsingSession[]): number {
        if (sessions.length === 0) {
            return 0;
        }

        let distractionCount = 0;
        const unproductiveCategories = ['social', 'entertainment', 'shopping'];

        for (const session of sessions) {
            // Sort tabs by ID as a proxy for time sequence
            const sortedTabs = [...session.tabs].sort((a, b) => a.tabId - b.tabId);

            for (let i = 1; i < sortedTabs.length; i++) {
                const prevTab = sortedTabs[i - 1];
                const currentTab = sortedTabs[i];

                // Count switch from productive to unproductive
                if (
                    !unproductiveCategories.includes(prevTab.category) &&
                    unproductiveCategories.includes(currentTab.category)
                ) {
                    distractionCount++;
                }
            }
        }

        return distractionCount;
    }

    /**
     * Calculate average focus time between distractions (in minutes)
     */
    private calculateAverageFocusTime(sessions: BrowsingSession[]): number {
        if (sessions.length === 0) {
            return 0;
        }

        let totalFocusTime = 0;
        let focusPeriods = 0;
        const productiveCategories = ['work', 'news'];

        for (const session of sessions) {
            // Sort tabs by ID as a proxy for time sequence
            const sortedTabs = [...session.tabs].sort((a, b) => a.tabId - b.tabId);

            let currentFocusTime = 0;
            let inFocus = false;

            for (const tab of sortedTabs) {
                if (productiveCategories.includes(tab.category)) {
                    currentFocusTime += tab.timeActive;
                    inFocus = true;
                } else if (inFocus) {
                    // End of a focus period
                    totalFocusTime += currentFocusTime;
                    focusPeriods++;
                    currentFocusTime = 0;
                    inFocus = false;
                }
            }

            // Add final focus period if still in focus
            if (inFocus && currentFocusTime > 0) {
                totalFocusTime += currentFocusTime;
                focusPeriods++;
            }
        }

        // Calculate average in minutes
        return focusPeriods > 0
            ? Math.round(totalFocusTime / focusPeriods / (60 * 1000))
            : 0;
    }

    /**
     * Find weekly data for the current week
     */
    private findCurrentWeekData(date: Date): WeeklyProductivityData | undefined {
        const weekStart = this.getStartOfWeek(date);
        const weekEnd = this.getEndOfWeek(date);

        const startDateString = this.getDateString(weekStart);
        const endDateString = this.getDateString(weekEnd);

        return this.weeklyData.find(w =>
            w.startDate === startDateString && w.endDate === endDateString
        );
    }

    /**
     * Create empty daily productivity data
     */
    private createEmptyDailyData(date: Date): DailyProductivityData {
        return {
            date: this.getDateString(date),
            productivityScore: 5, // Default middle score
            totalActiveTime: 0,
            tabsOpened: 0,
            tabsClosed: 0,
            categoryBreakdown: [],
            memoryUsage: {
                totalMemory: 0,
                usedMemory: 0,
                savedMemory: 0
            }
        };
    }

    /**
     * Create empty weekly productivity data
     */
    private createEmptyWeeklyData(date: Date): WeeklyProductivityData {
        const weekStart = this.getStartOfWeek(date);
        const weekEnd = this.getEndOfWeek(date);

        return {
            startDate: this.getDateString(weekStart),
            endDate: this.getDateString(weekEnd),
            averageProductivityScore: 5, // Default middle score
            dailyScores: {},
            totalActiveTime: 0,
            averageTabsPerDay: 0,
            categoryBreakdown: [],
            memoryUsage: {
                totalMemory: 0,
                usedMemory: 0,
                savedMemory: 0
            },
            productivityTrend: 'stable'
        };
    }

    /**
     * Clean up old data beyond retention period
     */
    private cleanupOldData(): void {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.options.dataRetentionDays);

        // Clean up sessions
        this.sessions = this.sessions.filter(session => session.endTime >= cutoffDate);

        // Clean up daily data
        for (const dateString of Object.keys(this.dailyData)) {
            const date = new Date(dateString);
            if (date < cutoffDate) {
                delete this.dailyData[dateString];
            }
        }

        // Clean up weekly data
        this.weeklyData = this.weeklyData.filter(weekData => {
            const weekEndDate = new Date(weekData.endDate);
            return weekEndDate >= cutoffDate;
        });
    }

    /**
     * Get date string in YYYY-MM-DD format
     */
    private getDateString(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get start of week (Sunday) for a given date
     */
    private getStartOfWeek(date: Date): Date {
        const result = new Date(date);
        const day = result.getDay();
        result.setDate(result.getDate() - day); // Go to Sunday
        result.setHours(0, 0, 0, 0);
        return result;
    }

    /**
     * Get end of week (Saturday) for a given date
     */
    private getEndOfWeek(date: Date): Date {
        const result = new Date(date);
        const day = result.getDay();
        result.setDate(result.getDate() + (6 - day)); // Go to Saturday
        result.setHours(23, 59, 59, 999);
        return result;
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Anonymize URL for privacy
     */
    private anonymizeUrl(url: string): string {
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
     * Anonymize tab title for privacy
     */
    private anonymizeTitle(title: string): string {
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
     * Clean up resources when analytics is no longer needed
     */
    cleanup(): void {
        this.stopPeriodicAnalysis();
    }
}