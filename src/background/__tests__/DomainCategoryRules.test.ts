import { RuleEngine, RuleEvaluationContext } from '../RuleEngine';
import { TabRule, SimpleRuleCondition, WebsiteCategory } from '../../shared/types';
import { TabActivityTracker } from '../TabActivityTracker';

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');

describe('Domain and Category-based Rules', () => {
  let ruleEngine: RuleEngine;
  let mockTabActivityTracker: jest.Mocked<TabActivityTracker>;

  beforeEach(() => {
    mockTabActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;
    ruleEngine = new RuleEngine(mockTabActivityTracker);
  });

  describe('Domain Matching with Wildcards', () => {
    test('matches exact domain correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Exact Domain Rule',
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
        url: 'https://sub.example.com',
        domain: 'sub.example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const results1 = ruleEngine.evaluateRules(matchingContext);
      const results2 = ruleEngine.evaluateRules(nonMatchingContext);

      expect(results1[0].matched).toBe(true);
      expect(results2[0].matched).toBe(false);
    });

    test('matches wildcard domain patterns correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Wildcard Domain Rule',
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
        url: 'https://sub.example.com',
        domain: 'sub.example.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const matchingContext2: RuleEvaluationContext = {
        url: 'https://another.sub.example.com',
        domain: 'another.sub.example.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://example.org',
        domain: 'example.org',
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

    test('matches complex wildcard patterns correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Complex Wildcard Rule',
        condition: {
          type: 'domain',
          operator: 'contains',
          value: '*mail*.com'
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
        url: 'https://mail.google.com',
        domain: 'mail.google.com',
        tabId: 1,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const matchingContext2: RuleEvaluationContext = {
        url: 'https://gmail.com',
        domain: 'gmail.com',
        tabId: 2,
        windowId: 1,
        tabCount: 10,
        currentTime: new Date(),
        isActive: true
      };

      const nonMatchingContext: RuleEvaluationContext = {
        url: 'https://example.org',
        domain: 'example.org',
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
  });

  describe('Category-based Rules', () => {
    test('matches website categories correctly', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Social Media Rule',
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

      const results1 = ruleEngine.evaluateRules(socialContext);
      const results2 = ruleEngine.evaluateRules(workContext);

      expect(results1[0].matched).toBe(true);
      expect(results2[0].matched).toBe(false);
    });

    test('matches multiple categories with contains operator', () => {
      const rule: TabRule = {
        id: '1',
        name: 'Entertainment and Social Rule',
        condition: {
          type: 'category',
          operator: 'contains',
          value: 'social,entertainment'
        } as SimpleRuleCondition,
        action: {
          type: 'limit_tabs',
          value: 5
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

      expect(results1[0].matched).toBe(true);
      expect(results2[0].matched).toBe(true);
      expect(results3[0].matched).toBe(false);
    });
  });

  describe('Category Tab Limits', () => {
    test('gets correct tab limits for each category', () => {
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
          name: 'Entertainment Limit',
          condition: {
            type: 'category',
            operator: 'equals',
            value: 'entertainment'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 5
          },
          priority: 0,
          enabled: true
        },
        {
          id: '3',
          name: 'Work Limit',
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

      const defaultLimit = 20;
      const categoryLimits = ruleEngine.getCategoryTabLimits(defaultLimit);

      expect(categoryLimits.get('social')).toBe(3);
      expect(categoryLimits.get('entertainment')).toBe(5);
      expect(categoryLimits.get('work')).toBe(10);
      expect(categoryLimits.get('news')).toBe(defaultLimit);
      expect(categoryLimits.get('shopping')).toBe(defaultLimit);
      expect(categoryLimits.get('other')).toBe(defaultLimit);
    });

    test('respects rule priority for category limits', () => {
      const rules: TabRule[] = [
        {
          id: '1',
          name: 'Low Priority Social Limit',
          condition: {
            type: 'category',
            operator: 'equals',
            value: 'social'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 5
          },
          priority: 10, // Lower priority (higher number)
          enabled: true
        },
        {
          id: '2',
          name: 'High Priority Social Limit',
          condition: {
            type: 'category',
            operator: 'equals',
            value: 'social'
          } as SimpleRuleCondition,
          action: {
            type: 'limit_tabs',
            value: 3
          },
          priority: 0, // Higher priority (lower number)
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

      const limit = ruleEngine.getTabLimitForContext(socialContext, 20);
      expect(limit).toBe(3); // Should use the higher priority rule
    });
  });

  describe('Website Categorization', () => {
    test('categorizes websites correctly', () => {
      expect(ruleEngine.categorizeWebsite('github.com')).toBe('work');
      expect(ruleEngine.categorizeWebsite('facebook.com')).toBe('social');
      expect(ruleEngine.categorizeWebsite('youtube.com')).toBe('entertainment');
      expect(ruleEngine.categorizeWebsite('nytimes.com')).toBe('news');
      expect(ruleEngine.categorizeWebsite('amazon.com')).toBe('shopping');
      expect(ruleEngine.categorizeWebsite('unknown-domain.com')).toBe('other');
    });

    test('categorizes subdomains correctly', () => {
      expect(ruleEngine.categorizeWebsite('dev.github.com')).toBe('work');
      expect(ruleEngine.categorizeWebsite('business.facebook.com')).toBe('social');
      expect(ruleEngine.categorizeWebsite('music.youtube.com')).toBe('entertainment');
    });

    test('static categorization works correctly', () => {
      expect(RuleEngine.categorizeUrl('https://github.com')).toBe('work');
      expect(RuleEngine.categorizeUrl('https://facebook.com')).toBe('social');
      expect(RuleEngine.categorizeUrl('https://youtube.com')).toBe('entertainment');
      expect(RuleEngine.categorizeUrl('https://nytimes.com')).toBe('news');
      expect(RuleEngine.categorizeUrl('https://amazon.com')).toBe('shopping');
      expect(RuleEngine.categorizeUrl('https://unknown-domain.com')).toBe('other');
    });
  });

  describe('Domain Examples for Categories', () => {
    test('returns correct domain examples for each category', () => {
      const workExamples = RuleEngine.getDomainExamplesForCategory('work');
      const socialExamples = RuleEngine.getDomainExamplesForCategory('social');
      const entertainmentExamples = RuleEngine.getDomainExamplesForCategory('entertainment');
      const newsExamples = RuleEngine.getDomainExamplesForCategory('news');
      const shoppingExamples = RuleEngine.getDomainExamplesForCategory('shopping');
      const otherExamples = RuleEngine.getDomainExamplesForCategory('other');

      expect(workExamples).toContain('github.com');
      expect(socialExamples).toContain('facebook.com');
      expect(entertainmentExamples).toContain('youtube.com');
      expect(newsExamples).toContain('cnn.com');
      expect(shoppingExamples).toContain('amazon.com');
      expect(otherExamples).toHaveLength(0);
    });
  });
});