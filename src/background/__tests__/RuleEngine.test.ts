import { RuleEngine, RuleEvaluationContext } from '../RuleEngine';
import { TabRule, RuleCondition, RuleAction, SimpleRuleCondition, CompositeRuleCondition } from '../../shared/types';
import { TabActivityTracker } from '../TabActivityTracker';

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;
  let mockTabActivityTracker: jest.Mocked<TabActivityTracker>;

  beforeEach(() => {
    mockTabActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;
    ruleEngine = new RuleEngine(mockTabActivityTracker);
  });

  describe('Rule Evaluation', () => {
    test('evaluates domain equals condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'domain',
          operator: 'equals',
          value: 'example.com'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const matchingContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://other.com',
        domain: 'other.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const matchingResults = ruleEngine.evaluateRules(matchingContext);
      const nonMatchingResults = ruleEngine.evaluateRules(nonMatchingContext);

      expect(matchingResults.length).toBe(1);
      expect(matchingResults[0].matched).toBe(true);
      expect(matchingResults[0].action).toEqual(rule.action);

      expect(nonMatchingResults.length).toBe(1);
      expect(nonMatchingResults[0].matched).toBe(false);
      expect(nonMatchingResults[0].action).toBeUndefined();
    });

    test('evaluates domain contains condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'domain',
          operator: 'contains',
          value: 'example'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const matchingContext: RuleEvaluationContext = {
        url: 'https://test.example.com',
        domain: 'test.example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://other.com',
        domain: 'other.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const matchingResults = ruleEngine.evaluateRules(matchingContext);
      const nonMatchingResults = ruleEngine.evaluateRules(nonMatchingContext);

      expect(matchingResults[0].matched).toBe(true);
      expect(nonMatchingResults[0].matched).toBe(false);
    });

    test('evaluates wildcard domain pattern correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'domain',
          operator: 'contains',
          value: '*.example.com'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const matchingContext1: RuleEvaluationContext = {
        url: 'https://test.example.com',
        domain: 'test.example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const matchingContext2: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://other.com',
        domain: 'other.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(matchingContext1);
      const results2 = ruleEngine.evaluateRules(matchingContext2);
      const results3 = ruleEngine.evaluateRules(nonMatchingContext);

      expect(results1[0].matched).toBe(true);
      expect(results2[0].matched).toBe(true);
      expect(results3[0].matched).toBe(false);
    });

    test('evaluates category condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'category',
          operator: 'equals',
          value: 'social'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 3
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const matchingContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://github.com',
        domain: 'github.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'work',
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(matchingContext);
      const results2 = ruleEngine.evaluateRules(nonMatchingContext);

      expect(results1[0].matched).toBe(true);
      expect(results2[0].matched).toBe(false);
    });

    test('evaluates time condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'time',
          operator: 'greater_than',
          value: 12 // After noon
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const morningTime = new Date();
      morningTime.setHours(10, 0, 0);

      const afternoonTime = new Date();
      afternoonTime.setHours(14, 0, 0);

      const morningContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: morningTime,
        isActive: true
      };

      const afternoonContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: afternoonTime,
        isActive: true
      };

      const morningResults = ruleEngine.evaluateRules(morningContext);
      const afternoonResults = ruleEngine.evaluateRules(afternoonContext);

      expect(morningResults[0].matched).toBe(false);
      expect(afternoonResults[0].matched).toBe(true);
    });

    test('evaluates tab count condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'tab_count',
          operator: 'greater_than',
          value: 5
        } as SimpleRuleCondition,
        action: {
          type: 'block_new_tabs',
          value: 0
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const fewTabsContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 3,
        currentTime: new Date(),
        isActive: true
      };

      const manyTabsContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const fewTabsResults = ruleEngine.evaluateRules(fewTabsContext);
      const manyTabsResults = ruleEngine.evaluateRules(manyTabsContext);

      expect(fewTabsResults[0].matched).toBe(false);
      expect(manyTabsResults[0].matched).toBe(true);
    });

    test('respects rule enabled flag', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Test Rule',
        condition: {
          type: 'domain',
          operator: 'equals',
          value: 'example.com'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: false // Disabled rule
      };

      ruleEngine.setRules([rule]);

      const context: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const results = ruleEngine.evaluateRules(context);

      // The rule is disabled, so it should not be evaluated
      expect(results.length).toBe(1);
      expect(results[0].matched).toBe(false);
    });

    test('evaluates day of week condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Weekday Rule',
        condition: {
          type: 'day_of_week',
          operator: 'in_range',
          value: [1, 5] // Monday to Friday
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      // Create a Monday date (day 1)
      const monday = new Date();
      monday.setDate(monday.getDate() + (1 - monday.getDay() + 7) % 7);

      // Create a Saturday date (day 6)
      const saturday = new Date();
      saturday.setDate(saturday.getDate() + (6 - saturday.getDay() + 7) % 7);

      const weekdayContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: monday,
        isActive: true
      };

      const weekendContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: saturday,
        isActive: true
      };

      const weekdayResults = ruleEngine.evaluateRules(weekdayContext);
      const weekendResults = ruleEngine.evaluateRules(weekendContext);

      expect(weekdayResults[0].matched).toBe(true);
      expect(weekendResults[0].matched).toBe(false);
    });

    test('evaluates composite AND condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Composite AND Rule',
        condition: {
          operator: 'and',
          conditions: [
            {
              type: 'category',
              operator: 'equals',
              value: 'social'
            },
            {
              type: 'time',
              operator: 'greater_than',
              value: 12 // After noon
            }
          ]
        } as CompositeRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 3
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const morningTime = new Date();
      morningTime.setHours(10, 0, 0);

      const afternoonTime = new Date();
      afternoonTime.setHours(14, 0, 0);

      const socialMorningContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: morningTime,
        category: 'social',
        isActive: true
      };

      const socialAfternoonContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: afternoonTime,
        category: 'social',
        isActive: true
      };

      const workAfternoonContext: RuleEvaluationContext = {
        url: 'https://github.com',
        domain: 'github.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10,
        currentTime: afternoonTime,
        category: 'work',
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(socialMorningContext);
      const results2 = ruleEngine.evaluateRules(socialAfternoonContext);
      const results3 = ruleEngine.evaluateRules(workAfternoonContext);

      // Social + Morning = false (not after noon)
      expect(results1[0].matched).toBe(false);
      
      // Social + Afternoon = true (both conditions match)
      expect(results2[0].matched).toBe(true);
      
      // Work + Afternoon = false (category doesn't match)
      expect(results3[0].matched).toBe(false);
    });

    test('evaluates composite OR condition correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Composite OR Rule',
        condition: {
          operator: 'or',
          conditions: [
            {
              type: 'category',
              operator: 'equals',
              value: 'social'
            },
            {
              type: 'category',
              operator: 'equals',
              value: 'entertainment'
            }
          ]
        } as CompositeRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 3
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const socialContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const entertainmentContext: RuleEvaluationContext = {
        url: 'https://youtube.com',
        domain: 'youtube.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'entertainment',
        isActive: true
      };

      const workContext: RuleEvaluationContext = {
        url: 'https://github.com',
        domain: 'github.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'work',
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(socialContext);
      const results2 = ruleEngine.evaluateRules(entertainmentContext);
      const results3 = ruleEngine.evaluateRules(workContext);

      // Social = true (first condition matches)
      expect(results1[0].matched).toBe(true);
      
      // Entertainment = true (second condition matches)
      expect(results2[0].matched).toBe(true);
      
      // Work = false (neither condition matches)
      expect(results3[0].matched).toBe(false);
    });

    test('evaluates nested composite conditions correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Nested Composite Rule',
        condition: {
          operator: 'and',
          conditions: [
            {
              type: 'tab_count',
              operator: 'greater_than',
              value: 5
            },
            {
              operator: 'or',
              conditions: [
                {
                  type: 'category',
                  operator: 'equals',
                  value: 'social'
                },
                {
                  type: 'category',
                  operator: 'equals',
                  value: 'entertainment'
                }
              ]
            }
          ]
        } as CompositeRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 3
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const fewTabsSocialContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 3, // Less than 5
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const manyTabsSocialContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10, // More than 5
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const manyTabsWorkContext: RuleEvaluationContext = {
        url: 'https://github.com',
        domain: 'github.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10, // More than 5
        currentTime: new Date(),
        category: 'work',
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(fewTabsSocialContext);
      const results2 = ruleEngine.evaluateRules(manyTabsSocialContext);
      const results3 = ruleEngine.evaluateRules(manyTabsWorkContext);

      // Few tabs + Social = false (tab count doesn't match)
      expect(results1[0].matched).toBe(false);
      
      // Many tabs + Social = true (both conditions match)
      expect(results2[0].matched).toBe(true);
      
      // Many tabs + Work = false (category doesn't match)
      expect(results3[0].matched).toBe(false);
    });
  });

  describe('Rule Conflict Resolution', () => {
    test('resolves conflicts by priority', () => {
      const rules: TabRule[] = [
        {
          id: '1',
          name: 'Low Priority Rule',
          condition: {
            type: 'domain',
            operator: 'contains',
            value: 'example'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 10
          },
          priority: 10, // Lower priority (higher number)
          enabled: true
        },
        {
          id: '2',
          name: 'High Priority Rule',
          condition: {
            type: 'domain',
            operator: 'contains',
            value: 'example'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 5
          },
          priority: 0, // Higher priority (lower number)
          enabled: true
        }
      ];

      ruleEngine.setRules(rules);

      const context: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const results = ruleEngine.evaluateRules(context);
      const resolvedActions = ruleEngine.resolveConflicts(results);

      // Both rules match, but the higher priority one should win
      expect(results.length).toBe(2);
      expect(results.filter(r => r.matched).length).toBe(2);
      
      expect(resolvedActions.length).toBe(1);
      expect(resolvedActions[0].value).toBe(5); // Value from the high priority rule
      
      // Check that conflicts were recorded
      const conflicts = ruleEngine.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].actionType).toBe('limit_tabs');
      expect(conflicts[0].rules.length).toBe(2);
      expect(conflicts[0].resolution.id).toBe('2'); // The high priority rule
    });

    test('handles multiple action types without conflicts', () => {
      const rules: TabRule[] = [
        {
          id: '1',
          name: 'Tab Limit Rule',
          condition: {
            type: 'domain',
            operator: 'contains',
            value: 'example'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 5
          },
          priority: 0,
          enabled: true
        },
        {
          id: '2',
          name: 'Block New Tabs Rule',
          condition: {
            type: 'domain',
            operator: 'contains',
            value: 'example'
          } as SimpleRuleCondition,
          action: {
            type: 'block_new_tabs',
            value: 0
          },
          priority: 1,
          enabled: true
        }
      ];

      ruleEngine.setRules(rules);

      const context: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const results = ruleEngine.evaluateRules(context);
      const resolvedActions = ruleEngine.resolveConflicts(results);

      // Both rules match and have different action types, so both should be included
      expect(results.length).toBe(2);
      expect(results.filter(r => r.matched).length).toBe(2);
      
      expect(resolvedActions.length).toBe(2);
      expect(resolvedActions.find(a => a.type === 'limit_tabs')?.value).toBe(5);
      expect(resolvedActions.find(a => a.type === 'block_new_tabs')).toBeDefined();
      
      // No conflicts should be recorded
      const conflicts = ruleEngine.getConflicts();
      expect(conflicts.length).toBe(0);
    });
  });

  describe('Helper Methods', () => {
    test('getTabLimitForContext returns correct limit', () => {
      const rules: TabRule[] = [
        {
          id: '1',
          name: 'Social Media Limit',
          condition: {
            type: 'category',
            operator: 'equals',
            value: 'social'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 3
          },
          priority: 0,
          enabled: true
        },
        {
          id: '2',
          name: 'Work Sites Limit',
          condition: {
            type: 'category',
            operator: 'equals',
            value: 'work'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 10
          },
          priority: 0,
          enabled: true
        }
      ];

      ruleEngine.setRules(rules);

      const socialContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const workContext: RuleEvaluationContext = {
        url: 'https://github.com',
        domain: 'github.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'work',
        isActive: true
      };

      const otherContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'other',
        isActive: true
      };

      const defaultLimit = 25;

      expect(ruleEngine.getTabLimitForContext(socialContext, defaultLimit)).toBe(3);
      expect(ruleEngine.getTabLimitForContext(workContext, defaultLimit)).toBe(10);
      expect(ruleEngine.getTabLimitForContext(otherContext, defaultLimit)).toBe(defaultLimit);
    });

    test('shouldBlockNewTabs returns correct value', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Block Social Media',
        condition: {
          type: 'category',
          operator: 'equals',
          value: 'social'
        } as SimpleRuleCondition,
        action: {
          type: 'block_new_tabs',
          value: 5 // Block when tab count >= 5
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const fewTabsContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 3,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const manyTabsContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 2,
        windowId: 1,
        tabCount: 7,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const otherContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 3,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'other',
        isActive: true
      };

      expect(ruleEngine.shouldBlockNewTabs(fewTabsContext)).toBe(false);
      expect(ruleEngine.shouldBlockNewTabs(manyTabsContext)).toBe(true);
      expect(ruleEngine.shouldBlockNewTabs(otherContext)).toBe(false);
    });

    test('shouldCloseTabs returns correct value', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Close Social Media Tabs',
        condition: {
          type: 'category',
          operator: 'equals',
          value: 'social'
        } as SimpleRuleCondition,
        action: {
          type: 'close_tabs',
          value: 15 // Close after 15 minutes
        },
        priority: 0,
        enabled: true
      };

      ruleEngine.setRules([rule]);

      const socialContext: RuleEvaluationContext = {
        url: 'https://facebook.com',
        domain: 'facebook.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'social',
        isActive: true
      };

      const otherContext: RuleEvaluationContext = {
        url: 'https://example.com',
        domain: 'example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        category: 'other',
        isActive: true
      };

      const socialResult = ruleEngine.shouldCloseTabs(socialContext);
      const otherResult = ruleEngine.shouldCloseTabs(otherContext);

      expect(socialResult.shouldClose).toBe(true);
      expect(socialResult.afterMinutes).toBe(15);

      expect(otherResult.shouldClose).toBe(false);
      expect(otherResult.afterMinutes).toBe(0);
    });
  });

  describe('URL Utilities', () => {
    test('urlMatchesDomain matches correctly', () => {
      expect(RuleEngine.urlMatchesDomain('https://example.com', ['example.com'])).toBe(true);
      expect(RuleEngine.urlMatchesDomain('https://sub.example.com', ['example.com'])).toBe(true);
      expect(RuleEngine.urlMatchesDomain('https://example.com', ['other.com'])).toBe(false);
      expect(RuleEngine.urlMatchesDomain('https://sub.example.com', ['*.example.com'])).toBe(true);
      expect(RuleEngine.urlMatchesDomain('https://example.com', ['*.example.com'])).toBe(true);
      expect(RuleEngine.urlMatchesDomain('https://other.com', ['*.example.com'])).toBe(false);
      expect(RuleEngine.urlMatchesDomain('https://anything.com', ['*'])).toBe(true);
    });

    test('categorizeUrl categorizes correctly', () => {
      expect(RuleEngine.categorizeUrl('https://github.com')).toBe('work');
      expect(RuleEngine.categorizeUrl('https://facebook.com')).toBe('social');
      expect(RuleEngine.categorizeUrl('https://youtube.com')).toBe('entertainment');
      expect(RuleEngine.categorizeUrl('https://nytimes.com')).toBe('news');
      expect(RuleEngine.categorizeUrl('https://amazon.com')).toBe('shopping');
      expect(RuleEngine.categorizeUrl('https://example.com')).toBe('other');
    });
  });

  describe('Context Creation', () => {
    test('createContextFromTab creates context correctly', async () => {
      const tab: chrome.tabs.Tab = {
        id: 123,
        index: 0,
        windowId: 456,
        highlighted: false,
        active: true,
        pinned: false,
        url: 'https://example.com',
        title: 'Example',
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1
      };

      mockTabActivityTracker.getTabActivity = jest.fn().mockReturnValue({
        tabId: 123,
        url: 'https://example.com',
        title: 'Example',
        domain: 'example.com',
        firstAccessed: new Date(),
        lastAccessed: new Date(),
        totalActiveTime: 1000,
        activationCount: 1,
        memoryUsage: 100,
        category: 'work',
        isActive: true,
        windowId: 456
      });

      const context = await ruleEngine.createContextFromTab(tab, 10);

      expect(context.url).toBe('https://example.com');
      expect(context.domain).toBe('example.com');
      expect(context.tabId).toBe(123);
      expect(context.windowId).toBe(456);
      expect(context.tabCount).toBe(10);
      expect(context.category).toBe('work');
      expect(context.isActive).toBe(true);
      expect(context.currentTime).toBeInstanceOf(Date);
    });
  });
});