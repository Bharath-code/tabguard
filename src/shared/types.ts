// Core TypeScript types for TabGuard Pro

export interface UserConfig {
  tabLimit: number;
  autoCloseEnabled: boolean;
  autoCloseDelay: number; // minutes
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  rules: TabRule[];
  profiles: UserProfile[];
}

export interface TabRule {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  enabled: boolean;
}

export type RuleConditionType = 'domain' | 'category' | 'time' | 'tab_count' | 'day_of_week' | 'focus_mode';
export type RuleOperator = 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range' | 'not_equals';
export type LogicalOperator = 'and' | 'or';

export interface SimpleRuleCondition {
  type: RuleConditionType;
  operator: RuleOperator;
  value: string | number | [number, number]; // For in_range operator, value is [min, max]
}

export interface CompositeRuleCondition {
  operator: LogicalOperator;
  conditions: (SimpleRuleCondition | CompositeRuleCondition)[];
}

export type RuleCondition = SimpleRuleCondition | CompositeRuleCondition;

export interface RuleAction {
  type: 'limit_tabs' | 'close_tabs' | 'block_new_tabs';
  value: number;
}

export interface UserProfile {
  id: string;
  name: string;
  config: UserConfig;
  isActive: boolean;
}

export interface TabSuggestion {
  tabId: number;
  title: string;
  url: string;
  lastAccessed: Date;
  memoryUsage: number;
  productivityScore: number;
}

export interface BrowsingSession {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  tabs: TabActivity[];
  productivityScore: number;
  memoryUsage: MemoryMetrics;
}

export interface TabActivity {
  tabId: number;
  url: string;
  title: string;
  timeActive: number; // milliseconds
  category: WebsiteCategory;
  memoryUsage: number;
}

export interface MemoryMetrics {
  totalMemory: number;
  usedMemory: number;
  savedMemory: number;
}

export type WebsiteCategory = 'work' | 'social' | 'entertainment' | 'news' | 'shopping' | 'other';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  tabLimit: number;
  aiInsights: boolean;
  teamFeatures: boolean;
}