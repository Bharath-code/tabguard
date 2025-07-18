/**
 * FocusModeManager for TabGuard Pro
 * 
 * Implements focus mode functionality with temporary stricter limits
 * and distraction blocking during focus sessions.
 * 
 * Implements requirements:
 * - 5.2: Apply different limits during work hours vs. personal time
 * - 5.4: Temporarily reduce tab limits and block distracting sites in focus mode
 */

import { RuleEngine } from './RuleEngine';
import { TabRule, SimpleRuleCondition, RuleAction } from '../shared/types';

export interface FocusModeSettings {
  // Whether focus mode is currently active
  active: boolean;

  // Tab limit during focus mode (stricter than normal)
  tabLimit: number;

  // Duration of focus session in minutes (0 = indefinite)
  duration: number;

  // Start time of current focus session
  startTime?: Date;

  // End time of current focus session
  endTime?: Date;

  // Whether to block distracting sites during focus mode
  blockDistractions: boolean;

  // Categories to block during focus mode
  blockedCategories: string[];

  // Custom domains to block during focus mode
  blockedDomains: string[];

  // Whether to allow temporary access to blocked sites
  allowTemporaryAccess: boolean;

  // Duration of temporary access in minutes
  temporaryAccessDuration: number;
}

export interface ScheduledFocusSession {
  id: string;
  name: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  enabled: boolean;
  settings: FocusModeSettings;
}

export interface TimeBasedRuleSchedule {
  id: string;
  name: string;
  ruleIds: string[]; // IDs of rules to activate
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  enabled: boolean;
}

export class FocusModeManager {
  private settings: FocusModeSettings;
  private ruleEngine: RuleEngine;
  private focusRules: TabRule[] = [];
  private originalRules: TabRule[] = [];
  private focusTimer: number | null = null;
  private scheduledSessions: ScheduledFocusSession[] = [];
  private timeBasedRules: TimeBasedRuleSchedule[] = [];
  private scheduleCheckInterval: number | null = null;
  private temporaryAccessList: Map<string, number> = new Map(); // domain -> expiration timestamp

  // Default focus mode settings
  private static readonly DEFAULT_SETTINGS: FocusModeSettings = {
    active: false,
    tabLimit: 5,
    duration: 25, // 25 minutes (pomodoro style)
    blockDistractions: true,
    blockedCategories: ['social', 'entertainment'],
    blockedDomains: [],
    allowTemporaryAccess: true,
    temporaryAccessDuration: 5 // 5 minutes
  };

  constructor(ruleEngine: RuleEngine) {
    this.ruleEngine = ruleEngine;
    this.settings = { ...FocusModeManager.DEFAULT_SETTINGS };

    // Load settings and schedules from storage
    this.loadSettings();
    this.loadSchedules();

    // Start schedule checker
    this.startScheduleChecker();
  }

  /**
   * Initialize focus mode manager
   */
  async initialize(): Promise<void> {
    try {
      // Create focus mode rules
      this.createFocusModeRules();

      console.log('FocusModeManager initialized');
    } catch (error) {
      console.error('Failed to initialize FocusModeManager:', error);
    }
  }

  /**
   * Start focus mode session
   * @param duration Duration in minutes (0 = indefinite)
   * @param settings Optional custom settings for this session
   */
  async startFocusMode(duration?: number, settings?: Partial<FocusModeSettings>): Promise<boolean> {
    try {
      // Stop any existing focus session
      this.stopFocusMode();

      // Update settings for this session
      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }

      // Set duration if provided
      if (duration !== undefined) {
        this.settings.duration = duration;
      }

      // Set start and end times
      const now = new Date();
      this.settings.startTime = now;

      if (this.settings.duration > 0) {
        const endTime = new Date(now.getTime() + this.settings.duration * 60 * 1000);
        this.settings.endTime = endTime;
      } else {
        this.settings.endTime = undefined; // Indefinite session
      }

      // Store original rules to restore later
      this.originalRules = this.ruleEngine.getRules();

      // Create and apply focus mode rules
      this.createFocusModeRules();

      // Set focus mode as active
      this.settings.active = true;

      // Save settings
      await this.saveSettings();

      // Set timer to end focus mode if duration is set
      if (this.settings.duration > 0) {
        this.focusTimer = setTimeout(() => {
          this.stopFocusMode();
        }, this.settings.duration * 60 * 1000) as unknown as number;
      }

      // Show notification
      this.showFocusModeNotification(true);

      console.log('Focus mode started:', this.settings);
      return true;
    } catch (error) {
      console.error('Error starting focus mode:', error);
      return false;
    }
  }

  /**
   * Stop focus mode session
   */
  async stopFocusMode(): Promise<boolean> {
    try {
      if (!this.settings.active) {
        return false; // Not active
      }

      // Clear focus timer if set
      if (this.focusTimer !== null) {
        clearTimeout(this.focusTimer);
        this.focusTimer = null;
      }

      // Restore original rules
      if (this.originalRules.length > 0) {
        this.ruleEngine.setRules(this.originalRules);
        this.originalRules = [];
      }

      // Set focus mode as inactive
      this.settings.active = false;
      this.settings.startTime = undefined;
      this.settings.endTime = undefined;

      // Clear temporary access list
      this.temporaryAccessList.clear();

      // Save settings
      await this.saveSettings();

      // Show notification
      this.showFocusModeNotification(false);

      console.log('Focus mode stopped');
      return true;
    } catch (error) {
      console.error('Error stopping focus mode:', error);
      return false;
    }
  }

  /**
   * Check if focus mode is active
   */
  isFocusModeActive(): boolean {
    return this.settings.active;
  }

  /**
   * Get current focus mode settings
   */
  getSettings(): FocusModeSettings {
    return { ...this.settings };
  }

  /**
   * Update focus mode settings
   */
  async updateSettings(settings: Partial<FocusModeSettings>): Promise<boolean> {
    try {
      // Update settings
      this.settings = { ...this.settings, ...settings };

      // If focus mode is active, update rules
      if (this.settings.active) {
        this.createFocusModeRules();
      }

      // Save settings
      await this.saveSettings();

      console.log('Focus mode settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('Error updating focus mode settings:', error);
      return false;
    }
  }

  /**
   * Check if a domain is blocked in focus mode
   */
  isDomainBlocked(domain: string): boolean {
    if (!this.settings.active || !this.settings.blockDistractions) {
      return false;
    }

    // Check if domain has temporary access
    if (this.hasTemporaryAccess(domain)) {
      return false;
    }

    // Check if domain is in blocked list
    for (const blockedDomain of this.settings.blockedDomains) {
      if (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)) {
        return true;
      }
    }

    // Check if domain category is blocked
    const category = this.ruleEngine.categorizeWebsite(domain);
    return this.settings.blockedCategories.includes(category);
  }

  /**
   * Grant temporary access to a blocked domain
   */
  async grantTemporaryAccess(domain: string): Promise<boolean> {
    try {
      if (!this.settings.active || !this.settings.allowTemporaryAccess) {
        return false;
      }

      const expirationTime = Date.now() + this.settings.temporaryAccessDuration * 60 * 1000;
      this.temporaryAccessList.set(domain, expirationTime);

      console.log(`Temporary access granted for ${domain} until ${new Date(expirationTime)}`);
      return true;
    } catch (error) {
      console.error('Error granting temporary access:', error);
      return false;
    }
  }

  /**
   * Check if a domain has temporary access
   */
  private hasTemporaryAccess(domain: string): boolean {
    if (!this.temporaryAccessList.has(domain)) {
      return false;
    }

    const expirationTime = this.temporaryAccessList.get(domain)!;
    const now = Date.now();

    if (now > expirationTime) {
      // Access expired, remove from list
      this.temporaryAccessList.delete(domain);
      return false;
    }

    return true;
  }

  /**
   * Create focus mode rules
   */
  private createFocusModeRules(): void {
    const rules: TabRule[] = [];

    // 1. Create tab limit rule
    const tabLimitRule: TabRule = {
      id: 'focus_tab_limit',
      name: 'Focus Mode Tab Limit',
      condition: {
        type: 'focus_mode',
        operator: 'equals',
        value: 1 // Using 1 to represent true
      } as SimpleRuleCondition,
      action: {
        type: 'limit_tabs',
        value: this.settings.tabLimit
      },
      priority: 0, // Highest priority
      enabled: true
    };

    rules.push(tabLimitRule);

    // 2. Create distraction blocking rules if enabled
    if (this.settings.blockDistractions) {
      // Block by category
      for (const category of this.settings.blockedCategories) {
        const categoryRule: TabRule = {
          id: `focus_block_${category}`,
          name: `Focus Mode Block ${category}`,
          condition: {
            operator: 'and',
            conditions: [
              {
                type: 'focus_mode',
                operator: 'equals',
                value: 1
              } as SimpleRuleCondition,
              {
                type: 'category',
                operator: 'equals',
                value: category
              } as SimpleRuleCondition
            ]
          },
          action: {
            type: 'block_new_tabs',
            value: 0
          },
          priority: 0, // Highest priority
          enabled: true
        };

        rules.push(categoryRule);
      }

      // Block specific domains
      if (this.settings.blockedDomains.length > 0) {
        for (const domain of this.settings.blockedDomains) {
          const domainRule: TabRule = {
            id: `focus_block_domain_${domain}`,
            name: `Focus Mode Block ${domain}`,
            condition: {
              operator: 'and',
              conditions: [
                {
                  type: 'focus_mode',
                  operator: 'equals',
                  value: 1 // Using 1 to represent true
                } as SimpleRuleCondition,
                {
                  type: 'domain',
                  operator: 'contains',
                  value: domain
                } as SimpleRuleCondition
              ]
            },
            action: {
              type: 'block_new_tabs',
              value: 0
            },
            priority: 0, // Highest priority
            enabled: true
          };

          rules.push(domainRule);
        }
      }
    }

    // Store focus rules
    this.focusRules = rules;

    // Combine with original rules (focus rules take precedence)
    const allRules = [...this.focusRules, ...this.originalRules];

    // Apply rules to rule engine
    this.ruleEngine.setRules(allRules);
  }

  /**
   * Show focus mode notification
   */
  private showFocusModeNotification(starting: boolean): void {
    try {
      const title = starting ? 'Focus Mode Started' : 'Focus Mode Ended';
      let message = starting
        ? `Focus mode active with a tab limit of ${this.settings.tabLimit}.`
        : 'Focus mode has ended. Regular tab limits restored.';

      if (starting && this.settings.duration > 0) {
        message += ` Session will end in ${this.settings.duration} minutes.`;
      }

      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon48.png',
        title: `TabGuard Pro - ${title}`,
        message,
        priority: 1
      });
    } catch (error) {
      console.error('Error showing focus mode notification:', error);
    }
  }

  /**
   * Add a scheduled focus session
   */
  async addScheduledSession(session: Omit<ScheduledFocusSession, 'id'>): Promise<string> {
    try {
      const id = `focus_session_${Date.now()}`;
      const newSession: ScheduledFocusSession = {
        ...session,
        id
      };

      this.scheduledSessions.push(newSession);
      await this.saveSchedules();

      console.log('Added scheduled focus session:', newSession);
      return id;
    } catch (error) {
      console.error('Error adding scheduled focus session:', error);
      throw error;
    }
  }

  /**
   * Update a scheduled focus session
   */
  async updateScheduledSession(id: string, updates: Partial<ScheduledFocusSession>): Promise<boolean> {
    try {
      const index = this.scheduledSessions.findIndex(session => session.id === id);

      if (index === -1) {
        return false;
      }

      this.scheduledSessions[index] = {
        ...this.scheduledSessions[index],
        ...updates
      };

      await this.saveSchedules();

      console.log('Updated scheduled focus session:', this.scheduledSessions[index]);
      return true;
    } catch (error) {
      console.error('Error updating scheduled focus session:', error);
      return false;
    }
  }

  /**
   * Delete a scheduled focus session
   */
  async deleteScheduledSession(id: string): Promise<boolean> {
    try {
      const initialLength = this.scheduledSessions.length;
      this.scheduledSessions = this.scheduledSessions.filter(session => session.id !== id);

      if (this.scheduledSessions.length < initialLength) {
        await this.saveSchedules();
        console.log('Deleted scheduled focus session:', id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting scheduled focus session:', error);
      return false;
    }
  }

  /**
   * Get all scheduled focus sessions
   */
  getScheduledSessions(): ScheduledFocusSession[] {
    return [...this.scheduledSessions];
  }

  /**
   * Add a time-based rule schedule
   */
  async addTimeBasedRule(rule: Omit<TimeBasedRuleSchedule, 'id'>): Promise<string> {
    try {
      const id = `time_rule_${Date.now()}`;
      const newRule: TimeBasedRuleSchedule = {
        ...rule,
        id
      };

      this.timeBasedRules.push(newRule);
      await this.saveSchedules();

      console.log('Added time-based rule schedule:', newRule);
      return id;
    } catch (error) {
      console.error('Error adding time-based rule schedule:', error);
      throw error;
    }
  }

  /**
   * Update a time-based rule schedule
   */
  async updateTimeBasedRule(id: string, updates: Partial<TimeBasedRuleSchedule>): Promise<boolean> {
    try {
      const index = this.timeBasedRules.findIndex(rule => rule.id === id);

      if (index === -1) {
        return false;
      }

      this.timeBasedRules[index] = {
        ...this.timeBasedRules[index],
        ...updates
      };

      await this.saveSchedules();

      console.log('Updated time-based rule schedule:', this.timeBasedRules[index]);
      return true;
    } catch (error) {
      console.error('Error updating time-based rule schedule:', error);
      return false;
    }
  }

  /**
   * Delete a time-based rule schedule
   */
  async deleteTimeBasedRule(id: string): Promise<boolean> {
    try {
      const initialLength = this.timeBasedRules.length;
      this.timeBasedRules = this.timeBasedRules.filter(rule => rule.id !== id);

      if (this.timeBasedRules.length < initialLength) {
        await this.saveSchedules();
        console.log('Deleted time-based rule schedule:', id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting time-based rule schedule:', error);
      return false;
    }
  }

  /**
   * Get all time-based rule schedules
   */
  getTimeBasedRules(): TimeBasedRuleSchedule[] {
    return [...this.timeBasedRules];
  }

  /**
   * Start schedule checker
   */
  private startScheduleChecker(): void {
    // Check schedules every minute
    const checkInterval = 60 * 1000; // 1 minute

    // Use a recursive setTimeout pattern which is more reliable in service workers
    const scheduleNextCheck = () => {
      this.scheduleCheckInterval = setTimeout(() => {
        this.checkSchedules();
        scheduleNextCheck();
      }, checkInterval) as unknown as number;
    };

    // Start the first check cycle
    scheduleNextCheck();

    console.log('Schedule checker started with interval:', checkInterval, 'ms');
  }

  /**
   * Stop schedule checker
   */
  private stopScheduleChecker(): void {
    if (this.scheduleCheckInterval !== null) {
      clearTimeout(this.scheduleCheckInterval);
      this.scheduleCheckInterval = null;
      console.log('Schedule checker stopped');
    }
  }

  /**
   * Check schedules for activation
   */
  private async checkSchedules(): Promise<void> {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      // Check focus session schedules
      for (const session of this.scheduledSessions) {
        if (!session.enabled) continue;

        // Check if today is a scheduled day
        if (!session.daysOfWeek.includes(currentDay)) continue;

        // Check if current time matches start time
        if (this.isTimeInRange(currentTimeString, session.startTime, session.endTime)) {
          // If focus mode is not active, start it
          if (!this.settings.active) {
            // Calculate duration in minutes
            const duration = this.calculateDurationInMinutes(session.startTime, session.endTime);
            await this.startFocusMode(duration, session.settings);
            console.log('Scheduled focus session started:', session.name);
          }
        } else if (this.settings.active) {
          // If outside the time range and focus mode is active due to this schedule, stop it
          const sessionEndTime = this.parseTimeString(session.endTime);
          const nowMinutes = currentHour * 60 + currentMinute;
          const endMinutes = sessionEndTime.hour * 60 + sessionEndTime.minute;

          // If we just passed the end time (within the last minute)
          if (Math.abs(nowMinutes - endMinutes) <= 1) {
            await this.stopFocusMode();
            console.log('Scheduled focus session ended:', session.name);
          }
        }
      }

      // Check time-based rule schedules
      await this.checkTimeBasedRules(currentDay, currentTimeString);

    } catch (error) {
      console.error('Error checking schedules:', error);
    }
  }

  /**
   * Check time-based rules for activation
   */
  private async checkTimeBasedRules(currentDay: number, currentTimeString: string): Promise<void> {
    try {
      // Get all rules from rule engine
      const allRules = this.ruleEngine.getRules();

      // Track which rules should be enabled based on schedules
      const rulesToEnable = new Set<string>();
      const rulesToDisable = new Set<string>();

      // Check each time-based rule schedule
      for (const schedule of this.timeBasedRules) {
        if (!schedule.enabled) continue;

        // Check if today is a scheduled day
        if (!schedule.daysOfWeek.includes(currentDay)) continue;

        // Check if current time is within the schedule
        const isActive = this.isTimeInRange(currentTimeString, schedule.startTime, schedule.endTime);

        // Mark rules for enabling or disabling
        for (const ruleId of schedule.ruleIds) {
          if (isActive) {
            rulesToEnable.add(ruleId);
          } else {
            rulesToDisable.add(ruleId);
          }
        }
      }

      // Apply rule changes
      let rulesChanged = false;

      const updatedRules = allRules.map(rule => {
        // Skip focus mode rules
        if (rule.id.startsWith('focus_')) {
          return rule;
        }

        // Enable or disable based on schedules
        if (rulesToEnable.has(rule.id) && !rule.enabled) {
          rulesChanged = true;
          return { ...rule, enabled: true };
        }

        if (rulesToDisable.has(rule.id) && rule.enabled && !rulesToEnable.has(rule.id)) {
          rulesChanged = true;
          return { ...rule, enabled: false };
        }

        return rule;
      });

      // Update rules if changes were made
      if (rulesChanged) {
        this.ruleEngine.setRules(updatedRules);
        console.log('Updated rule states based on time schedules');
      }
    } catch (error) {
      console.error('Error checking time-based rules:', error);
    }
  }

  /**
   * Check if a time is within a range
   */
  private isTimeInRange(timeString: string, startTimeString: string, endTimeString: string): boolean {
    const time = this.parseTimeString(timeString);
    const startTime = this.parseTimeString(startTimeString);
    const endTime = this.parseTimeString(endTimeString);

    const timeMinutes = time.hour * 60 + time.minute;
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;

    // Handle ranges that span midnight
    if (startMinutes > endMinutes) {
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Parse a time string (HH:MM) into hours and minutes
   */
  private parseTimeString(timeString: string): { hour: number; minute: number } {
    const [hourStr, minuteStr] = timeString.split(':');
    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10)
    };
  }

  /**
   * Calculate duration in minutes between two time strings
   */
  private calculateDurationInMinutes(startTimeString: string, endTimeString: string): number {
    const startTime = this.parseTimeString(startTimeString);
    const endTime = this.parseTimeString(endTimeString);

    let startMinutes = startTime.hour * 60 + startTime.minute;
    let endMinutes = endTime.hour * 60 + endTime.minute;

    // Handle ranges that span midnight
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add a day
    }

    return endMinutes - startMinutes;
  }

  /**
   * Load focus mode settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const { focusModeSettings } = await chrome.storage.sync.get('focusModeSettings');

      if (focusModeSettings) {
        // Convert date strings back to Date objects
        const settings = { ...focusModeSettings };

        if (settings.startTime) {
          settings.startTime = new Date(settings.startTime);
        }

        if (settings.endTime) {
          settings.endTime = new Date(settings.endTime);
        }

        this.settings = { ...this.settings, ...settings };

        // If focus mode was active when last saved, check if it should still be active
        if (this.settings.active && this.settings.endTime) {
          const now = new Date();
          if (now > this.settings.endTime) {
            // Focus mode should have ended
            this.settings.active = false;
            this.settings.startTime = undefined;
            this.settings.endTime = undefined;
          } else {
            // Focus mode should still be active, set timer for remaining time
            const remainingMs = this.settings.endTime.getTime() - now.getTime();
            this.focusTimer = setTimeout(() => {
              this.stopFocusMode();
            }, remainingMs) as unknown as number;
          }
        }

        console.log('Loaded focus mode settings:', this.settings);
      }
    } catch (error) {
      console.error('Error loading focus mode settings:', error);
    }
  }

  /**
   * Save focus mode settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.sync.set({ focusModeSettings: this.settings });
    } catch (error) {
      console.error('Error saving focus mode settings:', error);
    }
  }

  /**
   * Load schedules from storage
   */
  private async loadSchedules(): Promise<void> {
    try {
      const { focusSchedules, timeRuleSchedules } = await chrome.storage.sync.get([
        'focusSchedules',
        'timeRuleSchedules'
      ]);

      if (Array.isArray(focusSchedules)) {
        this.scheduledSessions = focusSchedules;
        console.log(`Loaded ${this.scheduledSessions.length} focus session schedules`);
      }

      if (Array.isArray(timeRuleSchedules)) {
        this.timeBasedRules = timeRuleSchedules;
        console.log(`Loaded ${this.timeBasedRules.length} time-based rule schedules`);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  }

  /**
   * Save schedules to storage
   */
  private async saveSchedules(): Promise<void> {
    try {
      await chrome.storage.sync.set({
        focusSchedules: this.scheduledSessions,
        timeRuleSchedules: this.timeBasedRules
      });
    } catch (error) {
      console.error('Error saving schedules:', error);
    }
  }

  /**
   * Clean up resources when manager is no longer needed
   */
  cleanup(): void {
    // Stop focus mode
    this.stopFocusMode();

    // Stop schedule checker
    this.stopScheduleChecker();
  }
}