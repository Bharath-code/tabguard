/**
 * RecommendationEngine for TabGuard Pro
 * 
 * Provides AI-powered recommendations for optimal tab limits,
 * personalized suggestions based on usage patterns, focus time
 * recommendations, and break reminders.
 * 
 * Implements requirements:
 * - 3.3: Generate personalized recommendations for optimal tab limits
 * - 3.4: Suggest focus modes or break reminders when productivity drops
 * - 3.5: Generate weekly productivity reports with actionable insights
 */

import { TabActivityTracker } from './TabActivityTracker';
import { BrowsingAnalytics } from './BrowsingAnalytics';
import { 
  ProductivityInsights, 
  CategoryBreakdown, 
  WebsiteCategory,
  FocusMetrics,
  UserConfig
} from '../shared/types';

export interface TabLimitRecommendation {
  recommendedLimit: number;
  currentLimit: number;
  confidence: number; // 0-1 scale
  reasoning: string;
}

export interface FocusTimeRecommendation {
  recommendedDuration: number; // minutes
  recommendedStartTime: string; // HH:MM format
  category: 'focus' | 'break';
  reasoning: string;
}

export interface ProductivityRecommendation {
  type: 'tab_limit' | 'focus_time' | 'break_reminder' | 'category_limit' | 'general';
  title: string;
  description: string;
  actionable: boolean;
  action?: {
    type: 'set_limit' | 'start_focus' | 'take_break' | 'close_tabs' | 'set_category_limit';
    value?: number | string;
    duration?: number; // minutes
  };
}

export interface WeeklyReport {
  startDate: string;
  endDate: string;
  productivityScore: number;
  productivityTrend: 'increasing' | 'decreasing' | 'stable';
  topCategories: Array<{category: WebsiteCategory, percentage: number}>;
  focusMetrics: FocusMetrics;
  tabMetrics: {
    averageTabCount: number;
    maxTabCount: number;
    tabTurnover: number; // tabs opened/closed per day
  };
  recommendations: ProductivityRecommendation[];
  insights: string[];
}

export class RecommendationEngine {
  private activityTracker: TabActivityTracker;
  private browsingAnalytics: BrowsingAnalytics;
  private userConfig: UserConfig | null = null;
  
  // Thresholds for recommendations
  private readonly HIGH_TAB_COUNT_THRESHOLD = 15;
  private readonly LOW_PRODUCTIVITY_THRESHOLD = 4.0;
  private readonly HIGH_PRODUCTIVITY_THRESHOLD = 7.0;
  private readonly FOCUS_SESSION_MIN_DURATION = 25; // minutes
  private readonly FOCUS_SESSION_MAX_DURATION = 90; // minutes
  private readonly BREAK_DURATION_SHORT = 5; // minutes
  private readonly BREAK_DURATION_LONG = 15; // minutes
  private readonly POMODORO_WORK_DURATION = 25; // minutes
  private readonly POMODORO_BREAK_DURATION = 5; // minutes
  
  constructor(activityTracker: TabActivityTracker, browsingAnalytics: BrowsingAnalytics) {
    this.activityTracker = activityTracker;
    this.browsingAnalytics = browsingAnalytics;
    this.loadUserConfig();
  }
  
  /**
   * Load user configuration from storage
   */
  private async loadUserConfig(): Promise<void> {
    try {
      const data = await chrome.storage.local.get('userConfig');
      if (data.userConfig) {
        this.userConfig = JSON.parse(data.userConfig);
      }
    } catch (error) {
      console.error('Error loading user config:', error);
    }
  }
  
  /**
   * Get the current tab limit from user config
   */
  private getCurrentTabLimit(): number {
    return this.userConfig?.tabLimit || 10; // Default to 10 if not set
  }
  
  /**
   * Calculate optimal tab limit based on user's browsing patterns and system performance
   */
  async getOptimalTabLimit(insights: ProductivityInsights): Promise<TabLimitRecommendation> {
    const currentLimit = this.getCurrentTabLimit();
    const activitySummary = this.activityTracker.getActivitySummary();
    
    // Base calculation factors
    const productivityFactor = this.calculateProductivityFactor(insights.productivityScore);
    const memoryFactor = this.calculateMemoryFactor(activitySummary.totalMemoryUsage);
    const focusFactor = this.calculateFocusFactor(insights.focusMetrics);
    const categoryFactor = this.calculateCategoryFactor(insights.categoryBreakdown || []);
    
    // Calculate weighted recommendation
    let recommendedLimit = Math.round(
      currentLimit * 0.3 + // Current limit has some weight
      10 * productivityFactor * 0.3 + // Productivity-based recommendation
      15 * memoryFactor * 0.2 + // Memory-based recommendation
      12 * focusFactor * 0.1 + // Focus-based recommendation
      10 * categoryFactor * 0.1 // Category-based recommendation
    );
    
    // Ensure reasonable bounds
    recommendedLimit = Math.max(3, Math.min(30, recommendedLimit));
    
    // Calculate confidence based on data quality
    const confidence = this.calculateRecommendationConfidence(insights);
    
    // Generate reasoning
    const reasoning = this.generateTabLimitReasoning(
      recommendedLimit, 
      currentLimit, 
      productivityFactor,
      memoryFactor,
      focusFactor,
      insights
    );
    
    return {
      recommendedLimit,
      currentLimit,
      confidence,
      reasoning
    };
  }
  
  /**
   * Calculate a factor (0-1) based on productivity score
   */
  private calculateProductivityFactor(productivityScore: number): number {
    // Higher productivity score = higher factor (can handle more tabs)
    return Math.min(1, Math.max(0.3, productivityScore / 10));
  }
  
  /**
   * Calculate a factor (0-1) based on memory usage
   */
  private calculateMemoryFactor(totalMemoryKB: number): number {
    // Lower memory usage = higher factor (can handle more tabs)
    const memoryGB = totalMemoryKB / (1024 * 1024);
    return Math.min(1, Math.max(0.3, 1 - (memoryGB / 8))); // Assuming 8GB as high memory usage
  }
  
  /**
   * Calculate a factor (0-1) based on focus metrics
   */
  private calculateFocusFactor(focusMetrics: FocusMetrics): number {
    // Higher focus score = higher factor (can handle more tabs without distraction)
    return Math.min(1, Math.max(0.3, focusMetrics.focusScore / 10));
  }
  
  /**
   * Calculate a factor (0-1) based on category breakdown
   */
  private calculateCategoryFactor(categoryBreakdown: CategoryBreakdown[]): number {
    // More work-related browsing = higher factor
    const workCategory = categoryBreakdown.find(c => c.category === 'work');
    const workPercentage = workCategory ? workCategory.percentage / 100 : 0;
    
    // More entertainment/social = lower factor
    const distractingCategories = categoryBreakdown
      .filter(c => c.category === 'entertainment' || c.category === 'social')
      .reduce((sum, c) => sum + c.percentage, 0) / 100;
    
    return Math.min(1, Math.max(0.3, workPercentage * 0.7 + (1 - distractingCategories) * 0.3));
  }
  
  /**
   * Calculate confidence in recommendation based on data quality
   */
  private calculateRecommendationConfidence(insights: ProductivityInsights): number {
    // Factors that increase confidence:
    // 1. More data points (more categories with significant time)
    // 2. Clear productivity patterns
    // 3. Consistent focus metrics
    
    const significantCategories = (insights.categoryBreakdown || [])
      .filter(c => c.percentage > 5).length;
    
    const hasConsistentFocus = insights.focusMetrics.focusScore > 0 && 
      insights.focusMetrics.averageFocusTime > 5;
    
    // Calculate confidence score
    let confidence = 0.5; // Base confidence
    
    if (significantCategories >= 3) confidence += 0.2;
    if (hasConsistentFocus) confidence += 0.2;
    if (insights.productivityScore > 0) confidence += 0.1;
    
    return Math.min(1, confidence);
  }
  
  /**
   * Generate reasoning for tab limit recommendation
   */
  private generateTabLimitReasoning(
    recommendedLimit: number,
    currentLimit: number,
    productivityFactor: number,
    memoryFactor: number,
    focusFactor: number,
    insights: ProductivityInsights
  ): string {
    if (recommendedLimit > currentLimit) {
      // Recommending higher limit
      if (productivityFactor > 0.7) {
        return `Your high productivity score (${insights.productivityScore.toFixed(1)}/10) suggests you can handle more tabs efficiently.`;
      } else if (memoryFactor > 0.7) {
        return `Your system has sufficient resources to handle more tabs without performance issues.`;
      } else {
        return `Based on your browsing patterns, you could benefit from a slightly higher tab limit.`;
      }
    } else if (recommendedLimit < currentLimit) {
      // Recommending lower limit
      if (productivityFactor < 0.5) {
        return `Reducing your tab limit may help improve your productivity score (currently ${insights.productivityScore.toFixed(1)}/10).`;
      } else if (memoryFactor < 0.5) {
        return `Reducing your tab limit could improve system performance and reduce memory usage.`;
      } else if (focusFactor < 0.5) {
        return `A lower tab limit may help you maintain focus and reduce distractions.`;
      } else {
        return `Based on your browsing patterns, a slightly lower tab limit might improve your workflow.`;
      }
    } else {
      // Same limit
      return `Your current tab limit appears to be optimal for your browsing habits.`;
    }
  }
  
  /**
   * Generate focus time recommendations based on productivity patterns
   */
  async getFocusTimeRecommendations(insights: ProductivityInsights): Promise<FocusTimeRecommendation[]> {
    const recommendations: FocusTimeRecommendation[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    
    // Determine if user needs a break
    const needsBreak = this.needsBreakReminder(insights);
    
    if (needsBreak) {
      // Recommend a break
      const breakDuration = insights.focusMetrics.longestFocusSession > 60 
        ? this.BREAK_DURATION_LONG 
        : this.BREAK_DURATION_SHORT;
      
      recommendations.push({
        recommendedDuration: breakDuration,
        recommendedStartTime: this.formatTime(now),
        category: 'break',
        reasoning: `You've been focusing for ${insights.focusMetrics.longestFocusSession} minutes. Taking a ${breakDuration}-minute break now can help maintain productivity.`
      });
    } else if (insights.productivityScore < this.LOW_PRODUCTIVITY_THRESHOLD) {
      // Productivity is low, recommend a focused session
      recommendations.push({
        recommendedDuration: this.POMODORO_WORK_DURATION,
        recommendedStartTime: this.formatTime(now),
        category: 'focus',
        reasoning: `Your productivity is currently low. A ${this.POMODORO_WORK_DURATION}-minute focused session using the Pomodoro technique could help you regain momentum.`
      });
    } else {
      // Regular focus session recommendation based on time of day
      let focusDuration = this.FOCUS_SESSION_MIN_DURATION;
      let startTime = now;
      
      // Morning focus (9-11 AM)
      if (currentHour >= 9 && currentHour <= 11) {
        focusDuration = this.FOCUS_SESSION_MAX_DURATION;
        startTime = now;
      } 
      // Early afternoon (1-3 PM)
      else if (currentHour >= 13 && currentHour <= 15) {
        focusDuration = this.FOCUS_SESSION_MIN_DURATION;
        startTime = now;
      }
      // Late afternoon (4-5 PM)
      else if (currentHour >= 16 && currentHour <= 17) {
        focusDuration = this.FOCUS_SESSION_MIN_DURATION;
        
        // Schedule for tomorrow morning if it's late afternoon
        if (currentHour >= 16) {
          startTime = new Date();
          startTime.setDate(startTime.getDate() + 1);
          startTime.setHours(9, 0, 0, 0);
        }
      }
      
      recommendations.push({
        recommendedDuration: focusDuration,
        recommendedStartTime: this.formatTime(startTime),
        category: 'focus',
        reasoning: this.generateFocusSessionReasoning(focusDuration, currentHour)
      });
    }
    
    return recommendations;
  }
  
  /**
   * Determine if user needs a break reminder
   */
  private needsBreakReminder(insights: ProductivityInsights): boolean {
    // Check if user has been focusing for too long
    const longFocusSession = insights.focusMetrics.longestFocusSession > 45;
    
    // Check if productivity is dropping
    const productivityDropping = insights.productivityScore < 
      (insights.productivityScore * 0.8); // 20% drop
    
    return longFocusSession || productivityDropping;
  }
  
  /**
   * Generate reasoning for focus session recommendation
   */
  private generateFocusSessionReasoning(duration: number, currentHour: number): string {
    if (currentHour >= 9 && currentHour <= 11) {
      return `Morning hours (9-11 AM) are typically your most productive time. A ${duration}-minute focused session now could yield great results.`;
    } else if (currentHour >= 13 && currentHour <= 15) {
      return `Early afternoon can be challenging for focus. A shorter ${duration}-minute session with a clear goal can help overcome the post-lunch productivity dip.`;
    } else if (currentHour >= 16 && currentHour <= 17) {
      return `Consider scheduling a ${duration}-minute focused session tomorrow morning when your energy levels will be higher.`;
    } else {
      return `A ${duration}-minute focused session can help you make progress on important tasks.`;
    }
  }
  
  /**
   * Format time as HH:MM
   */
  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  /**
   * Generate personalized recommendations based on productivity insights
   */
  async getPersonalizedRecommendations(insights: ProductivityInsights): Promise<ProductivityRecommendation[]> {
    const recommendations: ProductivityRecommendation[] = [];
    
    // Get optimal tab limit recommendation
    const tabLimitRec = await this.getOptimalTabLimit(insights);
    
    // Add tab limit recommendation if significantly different
    if (Math.abs(tabLimitRec.recommendedLimit - tabLimitRec.currentLimit) >= 3) {
      recommendations.push({
        type: 'tab_limit',
        title: `Adjust tab limit to ${tabLimitRec.recommendedLimit}`,
        description: tabLimitRec.reasoning,
        actionable: true,
        action: {
          type: 'set_limit',
          value: tabLimitRec.recommendedLimit
        }
      });
    }
    
    // Get focus time recommendations
    const focusRecs = await this.getFocusTimeRecommendations(insights);
    
    // Add focus/break recommendations
    for (const rec of focusRecs) {
      if (rec.category === 'focus') {
        recommendations.push({
          type: 'focus_time',
          title: `Schedule a ${rec.recommendedDuration}-minute focus session`,
          description: rec.reasoning,
          actionable: true,
          action: {
            type: 'start_focus',
            duration: rec.recommendedDuration
          }
        });
      } else {
        recommendations.push({
          type: 'break_reminder',
          title: `Take a ${rec.recommendedDuration}-minute break`,
          description: rec.reasoning,
          actionable: true,
          action: {
            type: 'take_break',
            duration: rec.recommendedDuration
          }
        });
      }
    }
    
    // Add category-specific recommendations
    this.addCategoryRecommendations(recommendations, insights);
    
    // Add general productivity tips based on score
    this.addGeneralProductivityTips(recommendations, insights);
    
    return recommendations;
  }
  
  /**
   * Add category-specific recommendations
   */
  private addCategoryRecommendations(
    recommendations: ProductivityRecommendation[],
    insights: ProductivityInsights
  ): void {
    const categoryBreakdown = insights.categoryBreakdown || [];
    
    // Check for excessive social media usage
    const socialCategory = categoryBreakdown.find(c => c.category === 'social');
    if (socialCategory && socialCategory.percentage > 25) {
      recommendations.push({
        type: 'category_limit',
        title: 'Reduce social media usage',
        description: `You're spending ${Math.round(socialCategory.percentage)}% of your browsing time on social media. Consider setting a limit for these sites.`,
        actionable: true,
        action: {
          type: 'set_category_limit',
          value: 'social'
        }
      });
    }
    
    // Check for excessive entertainment usage
    const entertainmentCategory = categoryBreakdown.find(c => c.category === 'entertainment');
    if (entertainmentCategory && entertainmentCategory.percentage > 30) {
      recommendations.push({
        type: 'category_limit',
        title: 'Limit entertainment browsing',
        description: `Entertainment sites account for ${Math.round(entertainmentCategory.percentage)}% of your browsing time. Consider scheduling specific times for these activities.`,
        actionable: true,
        action: {
          type: 'set_category_limit',
          value: 'entertainment'
        }
      });
    }
    
    // Check for low work category usage during work hours
    const workCategory = categoryBreakdown.find(c => c.category === 'work');
    const now = new Date();
    const isWorkHours = now.getHours() >= 9 && now.getHours() <= 17 && 
                        now.getDay() >= 1 && now.getDay() <= 5;
    
    if (isWorkHours && workCategory && workCategory.percentage < 40) {
      recommendations.push({
        type: 'general',
        title: 'Increase work-related browsing',
        description: 'During work hours, try to focus more on work-related websites to improve productivity.',
        actionable: false
      });
    }
  }
  
  /**
   * Add general productivity tips based on productivity score
   */
  private addGeneralProductivityTips(
    recommendations: ProductivityRecommendation[],
    insights: ProductivityInsights
  ): void {
    if (insights.productivityScore < this.LOW_PRODUCTIVITY_THRESHOLD) {
      // Low productivity tips
      recommendations.push({
        type: 'general',
        title: 'Try the 2-minute rule',
        description: 'If a task takes less than 2 minutes, do it immediately instead of keeping the tab open as a reminder.',
        actionable: false
      });
      
      recommendations.push({
        type: 'general',
        title: 'Group similar tabs',
        description: 'Use browser tab groups to organize related tabs and reduce visual clutter.',
        actionable: false
      });
    } else if (insights.productivityScore >= this.HIGH_PRODUCTIVITY_THRESHOLD) {
      // High productivity reinforcement
      recommendations.push({
        type: 'general',
        title: 'Maintain your productive rhythm',
        description: 'You\'re doing great! Consider documenting your current workflow to replicate in the future.',
        actionable: false
      });
    }
    
    // Add tab-specific recommendation if too many tabs are open
    const activitySummary = this.activityTracker.getActivitySummary();
    if (activitySummary.totalTabs > this.HIGH_TAB_COUNT_THRESHOLD) {
      recommendations.push({
        type: 'general',
        title: 'Close inactive tabs',
        description: `You currently have ${activitySummary.totalTabs} tabs open. Consider closing the ${activitySummary.inactiveTabs} inactive ones to improve focus and performance.`,
        actionable: true,
        action: {
          type: 'close_tabs'
        }
      });
    }
  }
  
  /**
   * Generate a weekly productivity report
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    // Get weekly insights from browsing analytics
    const insights = await this.browsingAnalytics.getWeekInsights();
    
    // Get date range for the week
    const now = new Date();
    const startDate = this.getStartOfWeek(now);
    const endDate = this.getEndOfWeek(now);
    
    // Get activity summary
    const activitySummary = this.activityTracker.getActivitySummary();
    
    // Generate personalized recommendations
    const recommendations = await this.getPersonalizedRecommendations(insights);
    
    // Generate insights based on the data
    const insightStrings = this.generateWeeklyInsights(insights, activitySummary);
    
    // Create weekly report
    const report: WeeklyReport = {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      productivityScore: insights.productivityScore,
      productivityTrend: this.determineProductivityTrend(insights),
      topCategories: (insights.categoryBreakdown || [])
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3)
        .map(c => ({ category: c.category, percentage: c.percentage })),
      focusMetrics: insights.focusMetrics,
      tabMetrics: {
        averageTabCount: activitySummary.totalTabs,
        maxTabCount: activitySummary.totalTabs * 1.2, // Estimate, would be tracked over time in real implementation
        tabTurnover: Math.round(activitySummary.totalTabs * 0.7) // Estimate, would be tracked over time
      },
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      insights: insightStrings
    };
    
    return report;
  }
  
  /**
   * Generate weekly insights based on data
   */
  private generateWeeklyInsights(
    insights: ProductivityInsights,
    activitySummary: any
  ): string[] {
    const insightStrings: string[] = [];
    
    // Productivity trend insight
    const trend = this.determineProductivityTrend(insights);
    if (trend === 'increasing') {
      insightStrings.push('Your productivity has been increasing this week. Keep up the good work!');
    } else if (trend === 'decreasing') {
      insightStrings.push('Your productivity has been declining this week. Consider implementing some of our recommendations.');
    } else {
      insightStrings.push('Your productivity has been stable this week.');
    }
    
    // Category distribution insight
    const categoryBreakdown = insights.categoryBreakdown || [];
    const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
    
    if (topCategory) {
      insightStrings.push(`You spent most of your time (${Math.round(topCategory.percentage)}%) on ${topCategory.category} websites.`);
    }
    
    // Focus metrics insight
    if (insights.focusMetrics.focusScore < 5) {
      insightStrings.push(`Your focus score is ${insights.focusMetrics.focusScore.toFixed(1)}/10. Try using the focus mode feature to improve concentration.`);
    } else if (insights.focusMetrics.focusScore >= 8) {
      insightStrings.push(`Excellent focus score of ${insights.focusMetrics.focusScore.toFixed(1)}/10! You're maintaining great concentration.`);
    }
    
    // Tab management insight
    if (activitySummary.totalTabs > this.HIGH_TAB_COUNT_THRESHOLD) {
      insightStrings.push(`You're keeping an average of ${activitySummary.totalTabs} tabs open. Consider using bookmarks instead of keeping tabs open as reminders.`);
    }
    
    // Time distribution insight
    const workCategory = categoryBreakdown.find(c => c.category === 'work');
    const socialCategory = categoryBreakdown.find(c => c.category === 'social');
    
    if (workCategory && socialCategory && workCategory.percentage < socialCategory.percentage) {
      insightStrings.push(`You're spending more time on social media (${Math.round(socialCategory.percentage)}%) than work-related sites (${Math.round(workCategory.percentage)}%). Consider adjusting this balance.`);
    }
    
    return insightStrings;
  }
  
  /**
   * Determine productivity trend from insights
   */
  private determineProductivityTrend(insights: ProductivityInsights): 'increasing' | 'decreasing' | 'stable' {
    // In a real implementation, this would analyze historical data
    // For now, we'll return a placeholder value
    return 'stable';
  }
  
  /**
   * Get start of week (Sunday)
   */
  private getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  }
  
  /**
   * Get end of week (Saturday)
   */
  private getEndOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    result.setHours(23, 59, 59, 999);
    return result;
  }
  
  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}