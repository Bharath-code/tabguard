import { FocusModeManager } from '../FocusModeManager';
import { RuleEngine } from '../RuleEngine';
import { TabActivityTracker } from '../TabActivityTracker';
import { TabRule } from '../../shared/types';

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  }
} as any;

// Mock TabActivityTracker
jest.mock('../TabActivityTracker');

describe('FocusModeManager', () => {
  let focusModeManager: FocusModeManager;
  let ruleEngine: RuleEngine;
  let mockTabActivityTracker: jest.Mocked<TabActivityTracker>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup storage mock to return empty objects
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() => Promise.resolve({}));
    (chrome.storage.sync.set as jest.Mock).mockImplementation(() => Promise.resolve());
    
    // Create dependencies
    mockTabActivityTracker = new TabActivityTracker() as jest.Mocked<TabActivityTracker>;
    ruleEngine = new RuleEngine(mockTabActivityTracker);
    
    // Spy on ruleEngine.setRules
    jest.spyOn(ruleEngine, 'setRules');
    jest.spyOn(ruleEngine, 'getRules').mockReturnValue([]);
    
    // Create FocusModeManager
    focusModeManager = new FocusModeManager(ruleEngine);
  });
  
  describe('Focus Mode Activation', () => {
    test('starts focus mode with default settings', async () => {
      await focusModeManager.initialize();
      const result = await focusModeManager.startFocusMode();
      
      expect(result).toBe(true);
      expect(focusModeManager.isFocusModeActive()).toBe(true);
      expect(ruleEngine.setRules).toHaveBeenCalled();
      expect(chrome.notifications.create).toHaveBeenCalled();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
    
    test('starts focus mode with custom duration', async () => {
      await focusModeManager.initialize();
      const result = await focusModeManager.startFocusMode(45); // 45 minutes
      
      expect(result).toBe(true);
      expect(focusModeManager.isFocusModeActive()).toBe(true);
      
      const settings = focusModeManager.getSettings();
      expect(settings.duration).toBe(45);
      expect(settings.endTime).toBeDefined();
    });
    
    test('stops focus mode', async () => {
      await focusModeManager.initialize();
      await focusModeManager.startFocusMode();
      
      const result = await focusModeManager.stopFocusMode();
      
      expect(result).toBe(true);
      expect(focusModeManager.isFocusModeActive()).toBe(false);
      expect(ruleEngine.setRules).toHaveBeenCalledTimes(2); // Once for start, once for stop
      expect(chrome.notifications.create).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Focus Mode Rules', () => {
    test('creates stricter tab limit rule', async () => {
      await focusModeManager.initialize();
      await focusModeManager.startFocusMode();
      
      // Verify that rules were set with a focus mode tab limit rule
      expect(ruleEngine.setRules).toHaveBeenCalled();
      
      const setRulesCalls = (ruleEngine.setRules as jest.Mock).mock.calls;
      const lastRulesSet = setRulesCalls[setRulesCalls.length - 1][0] as TabRule[];
      
      // Find the tab limit rule
      const tabLimitRule = lastRulesSet.find(rule => 
        rule.id === 'focus_tab_limit' && 
        rule.action.type === 'limit_tabs'
      );
      
      expect(tabLimitRule).toBeDefined();
      expect(tabLimitRule!.action.value).toBe(5); // Default tab limit in focus mode
    });
    
    test('creates distraction blocking rules', async () => {
      await focusModeManager.initialize();
      await focusModeManager.updateSettings({
        blockDistractions: true,
        blockedCategories: ['social', 'entertainment']
      });
      await focusModeManager.startFocusMode();
      
      const setRulesCalls = (ruleEngine.setRules as jest.Mock).mock.calls;
      const lastRulesSet = setRulesCalls[setRulesCalls.length - 1][0] as TabRule[];
      
      // Find the category blocking rules
      const socialBlockRule = lastRulesSet.find(rule => 
        rule.id === 'focus_block_social' && 
        rule.action.type === 'block_new_tabs'
      );
      
      const entertainmentBlockRule = lastRulesSet.find(rule => 
        rule.id === 'focus_block_entertainment' && 
        rule.action.type === 'block_new_tabs'
      );
      
      expect(socialBlockRule).toBeDefined();
      expect(entertainmentBlockRule).toBeDefined();
    });
  });
  
  describe('Domain Blocking', () => {
    test('correctly identifies blocked domains', async () => {
      await focusModeManager.initialize();
      await focusModeManager.updateSettings({
        blockDistractions: true,
        blockedDomains: ['facebook.com', 'twitter.com']
      });
      await focusModeManager.startFocusMode();
      
      // Should block main domains
      expect(focusModeManager.isDomainBlocked('facebook.com')).toBe(true);
      expect(focusModeManager.isDomainBlocked('twitter.com')).toBe(true);
      
      // Should block subdomains
      expect(focusModeManager.isDomainBlocked('www.facebook.com')).toBe(true);
      expect(focusModeManager.isDomainBlocked('mobile.twitter.com')).toBe(true);
      
      // Should not block unrelated domains
      expect(focusModeManager.isDomainBlocked('github.com')).toBe(false);
    });
    
    test('grants temporary access to blocked domains', async () => {
      await focusModeManager.initialize();
      await focusModeManager.updateSettings({
        blockDistractions: true,
        blockedDomains: ['facebook.com'],
        allowTemporaryAccess: true,
        temporaryAccessDuration: 5
      });
      await focusModeManager.startFocusMode();
      
      // Initially blocked
      expect(focusModeManager.isDomainBlocked('facebook.com')).toBe(true);
      
      // Grant temporary access
      await focusModeManager.grantTemporaryAccess('facebook.com');
      
      // Should now be allowed
      expect(focusModeManager.isDomainBlocked('facebook.com')).toBe(false);
    });
  });
  
  describe('Scheduled Sessions', () => {
    test('adds scheduled focus session', async () => {
      await focusModeManager.initialize();
      
      const sessionId = await focusModeManager.addScheduledSession({
        name: 'Morning Focus',
        startTime: '09:00',
        endTime: '12:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        enabled: true,
        settings: {
          active: false,
          tabLimit: 3,
          duration: 180,
          blockDistractions: true,
          blockedCategories: ['social'],
          blockedDomains: [],
          allowTemporaryAccess: true,
          temporaryAccessDuration: 5
        }
      });
      
      expect(sessionId).toBeDefined();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
      
      const sessions = focusModeManager.getScheduledSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].name).toBe('Morning Focus');
    });
    
    test('updates scheduled focus session', async () => {
      await focusModeManager.initialize();
      
      const sessionId = await focusModeManager.addScheduledSession({
        name: 'Morning Focus',
        startTime: '09:00',
        endTime: '12:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true,
        settings: {
          active: false,
          tabLimit: 3,
          duration: 180,
          blockDistractions: true,
          blockedCategories: ['social'],
          blockedDomains: [],
          allowTemporaryAccess: true,
          temporaryAccessDuration: 5
        }
      });
      
      const updateResult = await focusModeManager.updateScheduledSession(sessionId, {
        name: 'Updated Focus Session',
        enabled: false
      });
      
      expect(updateResult).toBe(true);
      
      const sessions = focusModeManager.getScheduledSessions();
      expect(sessions[0].name).toBe('Updated Focus Session');
      expect(sessions[0].enabled).toBe(false);
    });
    
    test('deletes scheduled focus session', async () => {
      await focusModeManager.initialize();
      
      const sessionId = await focusModeManager.addScheduledSession({
        name: 'Morning Focus',
        startTime: '09:00',
        endTime: '12:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true,
        settings: {
          active: false,
          tabLimit: 3,
          duration: 180,
          blockDistractions: true,
          blockedCategories: ['social'],
          blockedDomains: [],
          allowTemporaryAccess: true,
          temporaryAccessDuration: 5
        }
      });
      
      const deleteResult = await focusModeManager.deleteScheduledSession(sessionId);
      
      expect(deleteResult).toBe(true);
      
      const sessions = focusModeManager.getScheduledSessions();
      expect(sessions.length).toBe(0);
    });
  });
  
  describe('Time-Based Rules', () => {
    test('adds time-based rule schedule', async () => {
      await focusModeManager.initialize();
      
      const ruleId = await focusModeManager.addTimeBasedRule({
        name: 'Work Hours Rules',
        ruleIds: ['rule1', 'rule2'],
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        enabled: true
      });
      
      expect(ruleId).toBeDefined();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
      
      const rules = focusModeManager.getTimeBasedRules();
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('Work Hours Rules');
    });
    
    test('updates time-based rule schedule', async () => {
      await focusModeManager.initialize();
      
      const ruleId = await focusModeManager.addTimeBasedRule({
        name: 'Work Hours Rules',
        ruleIds: ['rule1', 'rule2'],
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true
      });
      
      const updateResult = await focusModeManager.updateTimeBasedRule(ruleId, {
        name: 'Updated Work Hours',
        enabled: false
      });
      
      expect(updateResult).toBe(true);
      
      const rules = focusModeManager.getTimeBasedRules();
      expect(rules[0].name).toBe('Updated Work Hours');
      expect(rules[0].enabled).toBe(false);
    });
    
    test('deletes time-based rule schedule', async () => {
      await focusModeManager.initialize();
      
      const ruleId = await focusModeManager.addTimeBasedRule({
        name: 'Work Hours Rules',
        ruleIds: ['rule1', 'rule2'],
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true
      });
      
      const deleteResult = await focusModeManager.deleteTimeBasedRule(ruleId);
      
      expect(deleteResult).toBe(true);
      
      const rules = focusModeManager.getTimeBasedRules();
      expect(rules.length).toBe(0);
    });
  });
});