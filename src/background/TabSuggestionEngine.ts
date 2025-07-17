/**
 * TabSuggestionEngine for TabGuard Pro
 * 
 * Provides intelligent tab closure suggestions based on activity data,
 * memory usage, and productivity scoring.
 * 
 * Implements requirements:
 * - 2.1: Suggest least active tabs for closure when limit is reached
 * - 2.2: Show tab title, last accessed time, and memory usage
 * - 2.3: Allow user to select suggested tabs for closure
 */

import { TabActivityTracker, TabActivityData } from './TabActivityTracker';
import { TabSuggestion, WebsiteCategory } from '../shared/types';

export interface SuggestionCriteria {
  // Maximum number of suggestions to return
  maxSuggestions: number;

  // Minimum inactivity time in minutes to consider a tab for closure
  minInactivityMinutes: number;

  // Whether to include pinned tabs in suggestions
  includePinnedTabs: boolean;

  // Whether to prioritize high memory usage tabs
  prioritizeMemoryUsage: boolean;

  // Whether to prioritize low productivity tabs
  prioritizeLowProductivity: boolean;

  // Whether to exclude work-related tabs
  excludeWorkTabs: boolean;
}

export interface ScoredTabSuggestion extends TabSuggestion {
  // Overall score (higher means more suitable for closure)
  closureScore: number;

  // Individual scoring factors
  inactivityScore: number;
  memoryScore: number;
  productivityScore: number;

  // Additional metadata
  inactiveMinutes: number;
  category: WebsiteCategory;
  isPinned: boolean;
}

export class TabSuggestionEngine {
  private activityTracker: TabActivityTracker;

  // Default suggestion criteria
  private defaultCriteria: SuggestionCriteria = {
    maxSuggestions: 5,
    minInactivityMinutes: 30,
    includePinnedTabs: false,
    prioritizeMemoryUsage: true,
    prioritizeLowProductivity: true,
    excludeWorkTabs: true
  };

  constructor(activityTracker: TabActivityTracker) {
    this.activityTracker = activityTracker;
  }

  /**
   * Get tab closure suggestions based on specified criteria
   */
  async getSuggestions(customCriteria?: Partial<SuggestionCriteria>): Promise<ScoredTabSuggestion[]> {
    try {
      // Merge default criteria with custom criteria
      const criteria: SuggestionCriteria = {
        ...this.defaultCriteria,
        ...customCriteria
      };

      // Get inactive tabs from activity tracker
      const inactiveTabs = this.activityTracker.getInactiveTabs(criteria.minInactivityMinutes);

      if (inactiveTabs.length === 0) {
        return [];
      }

      // Get all tabs to check for pinned status
      const allTabs = await chrome.tabs.query({});
      const pinnedTabIds = new Set(
        allTabs.filter(tab => tab.pinned && tab.id).map(tab => tab.id!)
      );

      // Score and filter tabs
      const scoredTabs = await this.scoreTabs(inactiveTabs, pinnedTabIds, criteria);

      // Sort by score (highest first) and limit to max suggestions
      return scoredTabs
        .sort((a, b) => b.closureScore - a.closureScore)
        .slice(0, criteria.maxSuggestions);
    } catch (error) {
      console.error('Error getting tab suggestions:', error);
      return [];
    }
  }

  /**
   * Score tabs based on multiple factors
   */
  private async scoreTabs(
    tabs: TabActivityData[],
    pinnedTabIds: Set<number>,
    criteria: SuggestionCriteria
  ): Promise<ScoredTabSuggestion[]> {
    const now = new Date();
    const scoredTabs: ScoredTabSuggestion[] = [];

    // Find maximum values for normalization
    let maxInactiveTime = 0;
    let maxMemoryUsage = 0;

    for (const tab of tabs) {
      const inactiveTime = now.getTime() - tab.lastAccessed.getTime();
      maxInactiveTime = Math.max(maxInactiveTime, inactiveTime);
      maxMemoryUsage = Math.max(maxMemoryUsage, tab.memoryUsage);
    }

    // Process each tab
    for (const tab of tabs) {
      // Skip pinned tabs if not included
      const isPinned = pinnedTabIds.has(tab.tabId);
      if (isPinned && !criteria.includePinnedTabs) {
        continue;
      }

      // Skip work tabs if excluded
      if (criteria.excludeWorkTabs && tab.category === 'work') {
        continue;
      }

      // Calculate inactivity time
      const inactiveTime = now.getTime() - tab.lastAccessed.getTime();
      const inactiveMinutes = inactiveTime / (1000 * 60);

      // Skip tabs that don't meet minimum inactivity threshold
      if (inactiveMinutes < criteria.minInactivityMinutes) {
        continue;
      }

      // Calculate individual scores (0-10 scale)
      const inactivityScore = maxInactiveTime > 0 ? (inactiveTime / maxInactiveTime) * 10 : 0;
      const memoryScore = maxMemoryUsage > 0 ? (tab.memoryUsage / maxMemoryUsage) * 10 : 0;

      // Calculate productivity score (inverted - lower productivity = higher score)
      const rawProductivityScore = this.getProductivityScore(tab.category);
      const productivityScore = 10 - rawProductivityScore;

      // Calculate overall score with weighted factors
      let closureScore = inactivityScore * 1.0; // Base weight for inactivity

      // Apply additional weights based on criteria
      if (criteria.prioritizeMemoryUsage) {
        closureScore += memoryScore * 0.8;
      }

      if (criteria.prioritizeLowProductivity) {
        closureScore += productivityScore * 0.6;
      }

      // Penalize pinned tabs
      if (isPinned) {
        closureScore *= 0.3;
      }

      // Create scored suggestion
      const suggestion: ScoredTabSuggestion = {
        tabId: tab.tabId,
        title: tab.title,
        url: tab.url,
        lastAccessed: tab.lastAccessed,
        memoryUsage: tab.memoryUsage,
        productivityScore: rawProductivityScore,
        closureScore,
        inactivityScore,
        memoryScore,
        inactiveMinutes,
        category: tab.category,
        isPinned
      };

      scoredTabs.push(suggestion);
    }

    return scoredTabs;
  }

  /**
   * Get productivity score for a website category (0-10 scale)
   * Higher score = more productive
   */
  private getProductivityScore(category: WebsiteCategory): number {
    switch (category) {
      case 'work':
        return 9;
      case 'news':
        return 6;
      case 'shopping':
        return 3;
      case 'social':
        return 2;
      case 'entertainment':
        return 1;
      case 'other':
      default:
        return 5;
    }
  }

  /**
   * Format time since last access in a human-readable format
   */
  static formatTimeSinceLastAccess(lastAccessed: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - lastAccessed.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      }
    }
  }

  /**
   * Format memory usage in a human-readable format
   */
  static formatMemoryUsage(memoryKb: number): string {
    if (memoryKb < 1024) {
      return `${memoryKb} KB`;
    } else {
      const memoryMb = memoryKb / 1024;
      return `${memoryMb.toFixed(1)} MB`;
    }
  }
}