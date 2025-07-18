/**
 * RuleEngine for TabGuard Pro
 * 
 * Handles evaluation of tab rules and applies actions based on conditions.
 * This class provides a comprehensive API for rule evaluation, conflict resolution,
 * and action execution based on tab rules.
 * 
 * @class RuleEngine
 */

import { TabRule, RuleCondition, RuleAction, WebsiteCategory, SimpleRuleCondition, CompositeRuleCondition } from '../shared/types';
import { TabActivityTracker } from './TabActivityTracker';

export interface RuleEvaluationContext {
    url: string;
    domain: string;
    tabId: number;
    windowId: number;
    tabCount: number;
    currentTime: Date;
    category?: WebsiteCategory;
    isActive: boolean;
}

export interface RuleEvaluationResult {
    rule: TabRule;
    matched: boolean;
    action?: RuleAction;
    priority: number;
}

export interface RuleConflict {
    rules: TabRule[];
    actionType: string;
    resolution: TabRule;
}

export class RuleEngine {
    private rules: TabRule[] = [];
    private conflicts: RuleConflict[] = [];
    private tabActivityTracker: TabActivityTracker;
    private domainCategoryMap: Map<string, WebsiteCategory> = new Map();

    constructor(tabActivityTracker: TabActivityTracker) {
        this.tabActivityTracker = tabActivityTracker;
        this.initializeDomainCategoryMap();
    }

    /**
     * Initialize the domain to category mapping
     */
    private initializeDomainCategoryMap(): void {
        // Work-related sites
        const workDomains = [
            'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
            'jira.com', 'confluence.com', 'notion.so', 'trello.com', 'asana.com',
            'slack.com', 'teams.microsoft.com', 'meet.google.com', 'zoom.us',
            'docs.google.com', 'office.com', 'microsoft.com', 'atlassian.com',
            'figma.com', 'miro.com', 'airtable.com', 'monday.com', 'linear.app'
        ];
        
        // Social media sites
        const socialDomains = [
            'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
            'reddit.com', 'pinterest.com', 'tumblr.com', 'whatsapp.com',
            'telegram.org', 'discord.com', 'tiktok.com', 'snapchat.com',
            'messenger.com', 'wechat.com', 'line.me', 'viber.com'
        ];
        
        // Entertainment sites
        const entertainmentDomains = [
            'youtube.com', 'netflix.com', 'hulu.com', 'disney.com', 'disneyplus.com',
            'spotify.com', 'twitch.tv', 'vimeo.com', 'dailymotion.com',
            'hbomax.com', 'primevideo.com', 'crunchyroll.com', 'funimation.com',
            'soundcloud.com', 'deezer.com', 'tidal.com', 'pandora.com'
        ];
        
        // News sites
        const newsDomains = [
            'cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com',
            'theguardian.com', 'reuters.com', 'apnews.com', 'bloomberg.com',
            'wsj.com', 'economist.com', 'ft.com', 'aljazeera.com',
            'npr.org', 'foxnews.com', 'nbcnews.com', 'abcnews.go.com'
        ];
        
        // Shopping sites
        const shoppingDomains = [
            'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
            'bestbuy.com', 'etsy.com', 'aliexpress.com', 'shopify.com',
            'wayfair.com', 'homedepot.com', 'ikea.com', 'costco.com',
            'newegg.com', 'zappos.com', 'macys.com', 'nordstrom.com'
        ];

        // Add domains to the map
        workDomains.forEach(domain => this.domainCategoryMap.set(domain, 'work'));
        socialDomains.forEach(domain => this.domainCategoryMap.set(domain, 'social'));
        entertainmentDomains.forEach(domain => this.domainCategoryMap.set(domain, 'entertainment'));
        newsDomains.forEach(domain => this.domainCategoryMap.set(domain, 'news'));
        shoppingDomains.forEach(domain => this.domainCategoryMap.set(domain, 'shopping'));
    }

    /**
     * Set the rules to be evaluated
     * @param rules Array of TabRule objects
     */
    setRules(rules: TabRule[]): void {
        // Sort rules by priority (lower number = higher priority)
        this.rules = [...rules].sort((a, b) => a.priority - b.priority);
        this.conflicts = []; // Reset conflicts when rules change
    }

    /**
     * Get the current rules
     * @returns Array of TabRule objects
     */
    getRules(): TabRule[] {
        return [...this.rules];
    }

    /**
     * Evaluate all enabled rules against a context
     * @param context The context to evaluate rules against
     * @returns Array of evaluation results
     */
    evaluateRules(context: RuleEvaluationContext): RuleEvaluationResult[] {
        const results: RuleEvaluationResult[] = [];

        // Process all rules, but only evaluate enabled ones
        for (const rule of this.rules) {
            const matched = rule.enabled ? this.evaluateCondition(rule.condition, context) : false;

            results.push({
                rule,
                matched,
                action: matched ? rule.action : undefined,
                priority: rule.priority
            });
        }

        return results;
    }

    /**
     * Get the highest priority matching rule for a specific action type
     * @param context The context to evaluate rules against
     * @param actionType The type of action to find
     * @returns The highest priority matching rule or null if none match
     */
    getMatchingRuleForAction(context: RuleEvaluationContext, actionType: string): TabRule | null {
        const results = this.evaluateRules(context);
        const matchingResults = results
            .filter(result => result.matched && result.action?.type === actionType)
            .sort((a, b) => a.priority - b.priority);

        return matchingResults.length > 0 ? matchingResults[0].rule : null;
    }

    /**
     * Resolve conflicts between rules with the same action type
     * @param results Array of evaluation results
     * @returns Array of resolved actions
     */
    resolveConflicts(results: RuleEvaluationResult[]): RuleAction[] {
        const matchedResults = results.filter(result => result.matched && result.action);
        const actionGroups = new Map<string, RuleEvaluationResult[]>();

        // Group results by action type
        for (const result of matchedResults) {
            const actionType = result.action!.type;
            if (!actionGroups.has(actionType)) {
                actionGroups.set(actionType, []);
            }
            actionGroups.get(actionType)!.push(result);
        }

        const resolvedActions: RuleAction[] = [];
        this.conflicts = []; // Reset conflicts

        // For each action type, take the highest priority rule (lowest priority number)
        for (const [actionType, resultsForType] of actionGroups.entries()) {
            if (resultsForType.length === 1) {
                // No conflict for this action type
                resolvedActions.push(resultsForType[0].action!);
            } else {
                // Sort by priority (lower number = higher priority)
                resultsForType.sort((a, b) => a.priority - b.priority);

                // Take the highest priority rule
                const highestPriorityResult = resultsForType[0];
                resolvedActions.push(highestPriorityResult.action!);

                // Record the conflict
                this.conflicts.push({
                    rules: resultsForType.map(r => r.rule),
                    actionType,
                    resolution: highestPriorityResult.rule
                });
            }
        }

        return resolvedActions;
    }

    /**
     * Get the tab limit for a specific context based on rules
     * @param context The context to evaluate rules against
     * @param defaultLimit The default tab limit if no rules match
     * @returns The tab limit to apply
     */
    getTabLimitForContext(context: RuleEvaluationContext, defaultLimit: number): number {
        const limitRule = this.getMatchingRuleForAction(context, 'limit_tabs');

        if (limitRule && typeof limitRule.action.value === 'number') {
            return limitRule.action.value;
        }

        return defaultLimit;
    }

    /**
     * Get tab limits for each category
     * @param defaultLimit The default tab limit if no rules match
     * @returns Map of category to tab limit
     */
    getCategoryTabLimits(defaultLimit: number): Map<WebsiteCategory, number> {
        const categoryLimits = new Map<WebsiteCategory, number>();
        const categories: WebsiteCategory[] = ['work', 'social', 'entertainment', 'news', 'shopping', 'other'];
        
        // Set default limit for all categories
        categories.forEach(category => categoryLimits.set(category, defaultLimit));
        
        // Find rules that set limits for specific categories
        for (const rule of this.rules) {
            if (!rule.enabled || rule.action.type !== 'limit_tabs') continue;
            
            // Check if this is a category-specific rule
            if ('type' in rule.condition && rule.condition.type === 'category') {
                const condition = rule.condition as SimpleRuleCondition;
                const category = condition.value as WebsiteCategory;
                
                if (condition.operator === 'equals' && categories.includes(category)) {
                    // This rule sets a limit for a specific category
                    categoryLimits.set(category, rule.action.value);
                }
            }
        }
        
        return categoryLimits;
    }

    /**
     * Check if new tabs should be blocked for a specific context
     * @param context The context to evaluate rules against
     * @returns Whether new tabs should be blocked
     */
    shouldBlockNewTabs(context: RuleEvaluationContext): boolean {
        const blockRule = this.getMatchingRuleForAction(context, 'block_new_tabs');

        if (blockRule) {
            // If the rule specifies a tab count threshold
            if (typeof blockRule.action.value === 'number') {
                return context.tabCount >= blockRule.action.value;
            }
            return true; // Block if rule matches and no specific threshold
        }

        return false;
    }

    /**
     * Check if tabs should be closed for a specific context
     * @param context The context to evaluate rules against
     * @returns Whether tabs should be closed and after how many minutes
     */
    shouldCloseTabs(context: RuleEvaluationContext): { shouldClose: boolean; afterMinutes: number } {
        const closeRule = this.getMatchingRuleForAction(context, 'close_tabs');

        if (closeRule && typeof closeRule.action.value === 'number') {
            return {
                shouldClose: true,
                afterMinutes: closeRule.action.value
            };
        }

        return {
            shouldClose: false,
            afterMinutes: 0
        };
    }

    /**
     * Evaluate a condition against a context
     * @param condition The condition to evaluate
     * @param context The context to evaluate against
     * @returns Whether the condition matches
     */
    private evaluateCondition(condition: RuleCondition, context: RuleEvaluationContext): boolean {
        // Handle composite conditions (AND/OR logic)
        if ('operator' in condition && ('conditions' in condition)) {
            const compositeCondition = condition as CompositeRuleCondition;

            if (compositeCondition.operator === 'and') {
                // All conditions must match for AND
                return compositeCondition.conditions.every(subCondition =>
                    this.evaluateCondition(subCondition, context)
                );
            } else if (compositeCondition.operator === 'or') {
                // At least one condition must match for OR
                return compositeCondition.conditions.some(subCondition =>
                    this.evaluateCondition(subCondition, context)
                );
            }

            console.warn(`Unknown logical operator: ${compositeCondition.operator}`);
            return false;
        }

        // Handle simple conditions
        const simpleCondition = condition as SimpleRuleCondition;

        switch (simpleCondition.type) {
            case 'domain':
                return this.evaluateDomainCondition(simpleCondition, context.domain);

            case 'category':
                return this.evaluateCategoryCondition(simpleCondition, context.category || 'other');

            case 'time':
                return this.evaluateTimeCondition(simpleCondition, context.currentTime);

            case 'tab_count':
                return this.evaluateTabCountCondition(simpleCondition, context.tabCount);

            case 'day_of_week':
                return this.evaluateDayOfWeekCondition(simpleCondition, context.currentTime);

            case 'focus_mode':
                return this.evaluateFocusModeCondition(simpleCondition, context);

            default:
                console.warn(`Unknown condition type: ${(simpleCondition as any).type}`);
                return false;
        }
    }

    /**
     * Evaluate a domain condition
     * @param condition The domain condition
     * @param domain The domain to check
     * @returns Whether the condition matches
     */
    private evaluateDomainCondition(condition: SimpleRuleCondition, domain: string): boolean {
        const value = condition.value as string;

        switch (condition.operator) {
            case 'equals':
                return domain === value;

            case 'not_equals':
                return domain !== value;

            case 'contains':
                // Handle wildcard patterns
                if (value === '*') {
                    return true; // Match all domains
                }

                if (value.includes('*')) {
                    // Convert wildcard pattern to regex
                    const regexPattern = value
                        .replace(/\./g, '\\.')  // Escape dots
                        .replace(/\*/g, '.*');  // Convert * to .*
                    
                    const regex = new RegExp(`^${regexPattern}$`);
                    return regex.test(domain);
                }

                // Check if domain contains the value or is a subdomain of value
                return domain.includes(value) || domain.endsWith(`.${value}`);

            default:
                return false;
        }
    }

    /**
     * Evaluate a category condition
     * @param condition The category condition
     * @param category The category to check
     * @returns Whether the condition matches
     */
    private evaluateCategoryCondition(condition: SimpleRuleCondition, category: WebsiteCategory): boolean {
        const value = condition.value as string;

        switch (condition.operator) {
            case 'equals':
                return category === value;

            case 'not_equals':
                return category !== value;

            case 'contains':
                // For contains, we're checking if the category is in a list
                // This allows for rules like "social or entertainment"
                const categories = value.split(',').map(c => c.trim());
                return categories.includes(category);

            default:
                return false;
        }
    }

    /**
     * Evaluate a time condition
     * @param condition The time condition
     * @param currentTime The current time
     * @returns Whether the condition matches
     */
    private evaluateTimeCondition(condition: SimpleRuleCondition, currentTime: Date): boolean {
        const hour = currentTime.getHours();

        switch (condition.operator) {
            case 'greater_than':
                return hour > (condition.value as number);

            case 'less_than':
                return hour < (condition.value as number);

            case 'equals':
                return hour === (condition.value as number);

            case 'not_equals':
                return hour !== (condition.value as number);

            case 'in_range':
                const [startHour, endHour] = condition.value as [number, number];
                return hour >= startHour && hour <= endHour;

            default:
                return false;
        }
    }

    /**
     * Evaluate a tab count condition
     * @param condition The tab count condition
     * @param tabCount The current tab count
     * @returns Whether the condition matches
     */
    private evaluateTabCountCondition(condition: SimpleRuleCondition, tabCount: number): boolean {
        const value = condition.value as number;

        switch (condition.operator) {
            case 'greater_than':
                return tabCount > value;

            case 'less_than':
                return tabCount < value;

            case 'equals':
                return tabCount === value;

            case 'not_equals':
                return tabCount !== value;

            case 'in_range':
                const [min, max] = condition.value as [number, number];
                return tabCount >= min && tabCount <= max;

            default:
                return false;
        }
    }

    /**
     * Evaluate a day of week condition
     * @param condition The day of week condition
     * @param currentTime The current time
     * @returns Whether the condition matches
     */
    private evaluateDayOfWeekCondition(condition: SimpleRuleCondition, currentTime: Date): boolean {
        const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday

        switch (condition.operator) {
            case 'equals':
                return dayOfWeek === condition.value;

            case 'not_equals':
                return dayOfWeek !== condition.value;

            case 'in_range':
                // For weekday range (e.g., Monday to Friday = 1-5)
                const [min, max] = condition.value as [number, number];
                return dayOfWeek >= min && dayOfWeek <= max;

            default:
                return false;
        }
    }

    /**
     * Evaluate a focus mode condition
     * @param condition The focus mode condition
     * @param context The evaluation context
     * @returns Whether the condition matches
     */
    private evaluateFocusModeCondition(condition: SimpleRuleCondition, context: RuleEvaluationContext): boolean {
        // This is a placeholder implementation
        // In a real implementation, we would check if focus mode is active
        // For now, we'll assume focus mode is not active

        // The value should be a boolean-like value (true/false or 1/0)
        const focusModeActive = false; // This would come from a focus mode service

        switch (condition.operator) {
            case 'equals':
                // Convert the condition value to a boolean for comparison
                // If it's a string "true"/"false" or number 1/0, convert accordingly
                let expectedValue = false;

                if (typeof condition.value === 'string') {
                    expectedValue = condition.value.toLowerCase() === 'true';
                } else if (typeof condition.value === 'number') {
                    expectedValue = condition.value !== 0;
                }
                // For arrays or other types, default to false

                return focusModeActive === expectedValue;

            default:
                return false;
        }
    }

    /**
     * Create a rule evaluation context from a tab
     * @param tab The tab to create context from
     * @param tabCount The current tab count
     * @returns A rule evaluation context
     */
    async createContextFromTab(tab: chrome.tabs.Tab, tabCount: number): Promise<RuleEvaluationContext> {
        const url = tab.url || '';
        let domain = '';

        try {
            if (url && url.startsWith('http')) {
                domain = new URL(url).hostname;
            }
        } catch (error) {
            console.error('Error parsing URL:', error);
        }

        // Get category from TabActivityTracker if available
        let category: WebsiteCategory | undefined;
        if (tab.id) {
            const tabActivity = this.tabActivityTracker.getTabActivity(tab.id);
            if (tabActivity) {
                category = tabActivity.category;
            } else {
                // If no activity data, categorize based on domain
                category = this.categorizeWebsite(domain);
            }
        }

        return {
            url,
            domain,
            tabId: tab.id || -1,
            windowId: tab.windowId,
            tabCount,
            currentTime: new Date(),
            category,
            isActive: tab.active || false
        };
    }

    /**
     * Get the conflicts that were detected during the last rule evaluation
     * @returns Array of rule conflicts
     */
    getConflicts(): RuleConflict[] {
        return [...this.conflicts];
    }

    /**
     * Check if a URL matches any domain in a list
     * @param url The URL to check
     * @param domainList List of domains to match against
     * @returns Whether the URL matches any domain in the list
     */
    static urlMatchesDomain(url: string, domainList: string[]): boolean {
        try {
            if (!url || !url.startsWith('http')) {
                return false;
            }

            const domain = new URL(url).hostname;

            for (const pattern of domainList) {
                if (pattern === '*') {
                    return true; // Match all domains
                }

                if (pattern.includes('*')) {
                    // Convert wildcard pattern to regex
                    const regexPattern = pattern
                        .replace(/\./g, '\\.')  // Escape dots
                        .replace(/\*/g, '.*');  // Convert * to .*
                    
                    const regex = new RegExp(`^${regexPattern}$`);
                    if (regex.test(domain)) {
                        return true;
                    }
                } else if (domain === pattern || domain.endsWith(`.${pattern}`)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Error matching URL to domain:', error);
            return false;
        }
    }

    /**
     * Categorize a website based on its domain
     * @param domain The domain to categorize
     * @returns The website category
     */
    categorizeWebsite(domain: string): WebsiteCategory {
        if (!domain) return 'other';
        
        // Check for exact domain match first
        if (this.domainCategoryMap.has(domain)) {
            return this.domainCategoryMap.get(domain)!;
        }
        
        // Check for subdomain or partial match
        for (const [mappedDomain, category] of this.domainCategoryMap.entries()) {
            if (domain.endsWith(`.${mappedDomain}`) || domain.includes(mappedDomain)) {
                return category;
            }
        }
        
        return 'other';
    }

    /**
     * Get the category for a URL
     * @param url The URL to categorize
     * @returns The website category
     */
    static categorizeUrl(url: string): WebsiteCategory {
        try {
            if (!url || !url.startsWith('http')) {
                return 'other';
            }

            const domain = new URL(url).hostname.toLowerCase();

            // Simple categorization based on domain patterns
            const categories: Record<WebsiteCategory, string[]> = {
                work: ['github.com', 'gitlab.com', 'bitbucket.org', 'jira.com', 'confluence.com', 'docs.google.com', 'office.com', 'slack.com', 'teams.microsoft.com'],
                social: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'pinterest.com', 'tumblr.com', 'whatsapp.com', 'telegram.org', 'discord.com'],
                entertainment: ['youtube.com', 'netflix.com', 'hulu.com', 'disney.com', 'spotify.com', 'twitch.tv', 'tiktok.com', 'vimeo.com', 'dailymotion.com'],
                news: ['cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'reuters.com', 'apnews.com', 'bloomberg.com'],
                shopping: ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'etsy.com', 'aliexpress.com', 'shopify.com'],
                other: []
            };

            for (const [category, domains] of Object.entries(categories)) {
                if (domains.some(d => domain.includes(d))) {
                    return category as WebsiteCategory;
                }
            }

            return 'other';
        } catch (error) {
            console.error('Error categorizing URL:', error);
            return 'other';
        }
    }

    /**
     * Get all available website categories
     * @returns Array of website categories
     */
    static getWebsiteCategories(): WebsiteCategory[] {
        return ['work', 'social', 'entertainment', 'news', 'shopping', 'other'];
    }

    /**
     * Get domain examples for a specific category
     * @param category The category to get examples for
     * @returns Array of domain examples
     */
    static getDomainExamplesForCategory(category: WebsiteCategory): string[] {
        switch (category) {
            case 'work':
                return ['github.com', 'slack.com', 'docs.google.com', 'office.com'];
            case 'social':
                return ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'];
            case 'entertainment':
                return ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv'];
            case 'news':
                return ['cnn.com', 'bbc.com', 'nytimes.com', 'reuters.com'];
            case 'shopping':
                return ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com'];
            default:
                return [];
        }
    }
}