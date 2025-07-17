/**
 * StorageManager for TabGuard Pro
 * 
 * Handles user settings persistence, validation, and migration.
 * This class provides a comprehensive API for managing extension configuration,
 * including validation, migration, backup/restore, and storage optimization.
 * 
 * @class StorageManager
 */

import { UserConfig, TabRule, UserProfile, RuleCondition, RuleAction } from './types';

/**
 * Represents a validation error for a specific field in the configuration
 */
export interface StorageValidationError {
  field: string;
  message: string;
  value: any;
}

/**
 * Result of a configuration migration operation
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  errors: string[];
  migratedFields?: string[];
}

export class StorageManager {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly CONFIG_KEY = 'userConfig';
  private static readonly VERSION_KEY = 'configVersion';
  private static readonly BACKUP_KEY = 'configBackup';

  // Default configuration that matches requirements
  private static readonly DEFAULT_CONFIG: UserConfig = {
    tabLimit: 10, // Requirement 1.5: default limit of 10 tabs
    autoCloseEnabled: false,
    autoCloseDelay: 30,
    theme: 'auto', // Requirement 4.2: theme customization
    notificationsEnabled: true, // Requirement 4.2: customizable notifications
    rules: [],
    profiles: []
  };

  /**
   * Initialize storage with default configuration if not exists
   * Requirement 1.5: Set default limit when extension is first installed
   */
  async initialize(): Promise<void> {
    try {
      const existingConfig = await this.getUserConfig();
      
      if (!existingConfig) {
        await this.setUserConfig(StorageManager.DEFAULT_CONFIG);
        await this.setConfigVersion(StorageManager.CURRENT_VERSION);
        console.log('StorageManager: Initialized with default configuration');
      } else {
        // Check if migration is needed
        await this.migrateIfNeeded();
      }
    } catch (error) {
      console.error('StorageManager: Failed to initialize:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  /**
   * Get user configuration with validation
   */
  async getUserConfig(): Promise<UserConfig | null> {
    try {
      const result = await chrome.storage.sync.get(StorageManager.CONFIG_KEY);
      const config = result[StorageManager.CONFIG_KEY];
      
      if (!config) {
        return null;
      }

      // Validate configuration
      const validationErrors = this.validateConfig(config);
      if (validationErrors.length > 0) {
        console.warn('StorageManager: Configuration validation errors:', validationErrors);
        // Return sanitized config or default if validation fails
        return this.sanitizeConfig(config);
      }

      return config;
    } catch (error) {
      console.error('StorageManager: Failed to get user config:', error);
      throw new Error(`Failed to retrieve configuration: ${error}`);
    }
  }

  /**
   * Set user configuration with validation
   */
  async setUserConfig(config: UserConfig): Promise<void> {
    try {
      // Validate configuration before saving
      const validationErrors = this.validateConfig(config);
      if (validationErrors.length > 0) {
        throw new Error(`Configuration validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
      }

      // Create backup of current config
      await this.createBackup();

      // Save new configuration
      await chrome.storage.sync.set({ [StorageManager.CONFIG_KEY]: config });
      console.log('StorageManager: Configuration saved successfully');
    } catch (error) {
      console.error('StorageManager: Failed to set user config:', error);
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Update specific configuration field
   */
  async updateConfigField<K extends keyof UserConfig>(
    field: K, 
    value: UserConfig[K]
  ): Promise<void> {
    try {
      const currentConfig = await this.getUserConfig();
      if (!currentConfig) {
        throw new Error('No configuration found to update');
      }

      const updatedConfig = { ...currentConfig, [field]: value };
      await this.setUserConfig(updatedConfig);
    } catch (error) {
      console.error(`StorageManager: Failed to update field ${String(field)}:`, error);
      throw new Error(`Failed to update ${String(field)}: ${error}`);
    }
  }

  /**
   * Get configuration version
   */
  async getConfigVersion(): Promise<string> {
    try {
      const result = await chrome.storage.sync.get(StorageManager.VERSION_KEY);
      return result[StorageManager.VERSION_KEY] || '0.0.0';
    } catch (error) {
      console.error('StorageManager: Failed to get config version:', error);
      return '0.0.0';
    }
  }

  /**
   * Set configuration version
   */
  private async setConfigVersion(version: string): Promise<void> {
    try {
      await chrome.storage.sync.set({ [StorageManager.VERSION_KEY]: version });
    } catch (error) {
      console.error('StorageManager: Failed to set config version:', error);
      throw error;
    }
  }

  /**
   * Create backup of current configuration
   * Creates a timestamped backup in local storage
   * 
   * @returns Promise that resolves when backup is complete
   */
  async createBackup(): Promise<void> {
    try {
      const currentConfig = await chrome.storage.sync.get(StorageManager.CONFIG_KEY);
      if (currentConfig[StorageManager.CONFIG_KEY]) {
        const backup = {
          config: currentConfig[StorageManager.CONFIG_KEY],
          timestamp: new Date().toISOString(),
          version: await this.getConfigVersion()
        };
        await chrome.storage.local.set({ [StorageManager.BACKUP_KEY]: backup });
      }
    } catch (error) {
      console.error('StorageManager: Failed to create backup:', error);
      // Don't throw - backup failure shouldn't prevent config updates
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(StorageManager.BACKUP_KEY);
      const backup = result[StorageManager.BACKUP_KEY];
      
      if (!backup || !backup.config) {
        return false;
      }

      await chrome.storage.sync.set({ [StorageManager.CONFIG_KEY]: backup.config });
      await this.setConfigVersion(backup.version || '0.0.0');
      
      console.log('StorageManager: Configuration restored from backup');
      return true;
    } catch (error) {
      console.error('StorageManager: Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Validate configuration object
   */
  private validateConfig(config: any): StorageValidationError[] {
    const errors: StorageValidationError[] = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        field: 'root',
        message: 'Configuration must be an object',
        value: config
      });
      return errors;
    }

    // Validate tabLimit
    if (typeof config.tabLimit !== 'number' || config.tabLimit < 1 || config.tabLimit > 1000) {
      errors.push({
        field: 'tabLimit',
        message: 'Tab limit must be a number between 1 and 1000',
        value: config.tabLimit
      });
    }

    // Validate autoCloseEnabled
    if (typeof config.autoCloseEnabled !== 'boolean') {
      errors.push({
        field: 'autoCloseEnabled',
        message: 'Auto close enabled must be a boolean',
        value: config.autoCloseEnabled
      });
    }

    // Validate autoCloseDelay
    if (typeof config.autoCloseDelay !== 'number' || config.autoCloseDelay < 1 || config.autoCloseDelay > 1440) {
      errors.push({
        field: 'autoCloseDelay',
        message: 'Auto close delay must be a number between 1 and 1440 minutes',
        value: config.autoCloseDelay
      });
    }

    // Validate theme
    const validThemes = ['light', 'dark', 'auto'];
    if (!validThemes.includes(config.theme)) {
      errors.push({
        field: 'theme',
        message: 'Theme must be one of: light, dark, auto',
        value: config.theme
      });
    }

    // Validate notificationsEnabled
    if (typeof config.notificationsEnabled !== 'boolean') {
      errors.push({
        field: 'notificationsEnabled',
        message: 'Notifications enabled must be a boolean',
        value: config.notificationsEnabled
      });
    }

    // Validate rules array
    if (!Array.isArray(config.rules)) {
      errors.push({
        field: 'rules',
        message: 'Rules must be an array',
        value: config.rules
      });
    } else {
      config.rules.forEach((rule: any, index: number) => {
        const ruleErrors = this.validateTabRule(rule, `rules[${index}]`);
        errors.push(...ruleErrors);
      });
    }

    // Validate profiles array
    if (!Array.isArray(config.profiles)) {
      errors.push({
        field: 'profiles',
        message: 'Profiles must be an array',
        value: config.profiles
      });
    } else {
      config.profiles.forEach((profile: any, index: number) => {
        const profileErrors = this.validateUserProfile(profile, `profiles[${index}]`);
        errors.push(...profileErrors);
      });
    }

    return errors;
  }

  /**
   * Validate TabRule object
   * Ensures that the rule object conforms to the TabRule interface
   * 
   * @param rule - The rule object to validate
   * @param fieldPrefix - Prefix for error field names
   * @returns Array of validation errors
   */
  private validateTabRule(rule: any, fieldPrefix: string): StorageValidationError[] {
    const errors: StorageValidationError[] = [];

    if (!rule || typeof rule !== 'object') {
      errors.push({
        field: fieldPrefix,
        message: 'Rule must be an object',
        value: rule
      });
      return errors;
    }

    // Validate required fields
    if (typeof rule.id !== 'string' || rule.id.length === 0) {
      errors.push({
        field: `${fieldPrefix}.id`,
        message: 'Rule ID must be a non-empty string',
        value: rule.id
      });
    }

    if (typeof rule.name !== 'string' || rule.name.length === 0) {
      errors.push({
        field: `${fieldPrefix}.name`,
        message: 'Rule name must be a non-empty string',
        value: rule.name
      });
    }

    if (typeof rule.priority !== 'number' || rule.priority < 0) {
      errors.push({
        field: `${fieldPrefix}.priority`,
        message: 'Rule priority must be a non-negative number',
        value: rule.priority
      });
    }

    if (typeof rule.enabled !== 'boolean') {
      errors.push({
        field: `${fieldPrefix}.enabled`,
        message: 'Rule enabled must be a boolean',
        value: rule.enabled
      });
    }

    // Validate condition
    if (!rule.condition || typeof rule.condition !== 'object') {
      errors.push({
        field: `${fieldPrefix}.condition`,
        message: 'Rule condition must be an object',
        value: rule.condition
      });
    } else {
      // Validate condition type
      const validConditionTypes = ['domain', 'category', 'time', 'tab_count'];
      if (!validConditionTypes.includes(rule.condition.type)) {
        errors.push({
          field: `${fieldPrefix}.condition.type`,
          message: `Condition type must be one of: ${validConditionTypes.join(', ')}`,
          value: rule.condition.type
        });
      }

      // Validate condition operator
      const validOperators = ['equals', 'contains', 'greater_than', 'less_than'];
      if (!validOperators.includes(rule.condition.operator)) {
        errors.push({
          field: `${fieldPrefix}.condition.operator`,
          message: `Condition operator must be one of: ${validOperators.join(', ')}`,
          value: rule.condition.operator
        });
      }

      // Validate condition value based on type
      if (rule.condition.type === 'domain' || rule.condition.type === 'category') {
        if (typeof rule.condition.value !== 'string') {
          errors.push({
            field: `${fieldPrefix}.condition.value`,
            message: `Value for ${rule.condition.type} condition must be a string`,
            value: rule.condition.value
          });
        }
      } else if (rule.condition.type === 'time' || rule.condition.type === 'tab_count') {
        if (typeof rule.condition.value !== 'number') {
          errors.push({
            field: `${fieldPrefix}.condition.value`,
            message: `Value for ${rule.condition.type} condition must be a number`,
            value: rule.condition.value
          });
        }
      }
    }

    // Validate action
    if (!rule.action || typeof rule.action !== 'object') {
      errors.push({
        field: `${fieldPrefix}.action`,
        message: 'Rule action must be an object',
        value: rule.action
      });
    } else {
      // Validate action type
      const validActionTypes = ['limit_tabs', 'close_tabs', 'block_new_tabs'];
      if (!validActionTypes.includes(rule.action.type)) {
        errors.push({
          field: `${fieldPrefix}.action.type`,
          message: `Action type must be one of: ${validActionTypes.join(', ')}`,
          value: rule.action.type
        });
      }

      // Validate action value
      if (typeof rule.action.value !== 'number' || rule.action.value < 0) {
        errors.push({
          field: `${fieldPrefix}.action.value`,
          message: 'Action value must be a non-negative number',
          value: rule.action.value
        });
      }
    }

    return errors;
  }

  /**
   * Validate UserProfile object
   * Ensures that the profile object conforms to the UserProfile interface
   * 
   * @param profile - The profile object to validate
   * @param fieldPrefix - Prefix for error field names
   * @returns Array of validation errors
   */
  private validateUserProfile(profile: any, fieldPrefix: string): StorageValidationError[] {
    const errors: StorageValidationError[] = [];

    if (!profile || typeof profile !== 'object') {
      errors.push({
        field: fieldPrefix,
        message: 'Profile must be an object',
        value: profile
      });
      return errors;
    }

    // Validate required fields
    if (typeof profile.id !== 'string' || profile.id.length === 0) {
      errors.push({
        field: `${fieldPrefix}.id`,
        message: 'Profile ID must be a non-empty string',
        value: profile.id
      });
    }

    if (typeof profile.name !== 'string' || profile.name.length === 0) {
      errors.push({
        field: `${fieldPrefix}.name`,
        message: 'Profile name must be a non-empty string',
        value: profile.name
      });
    }

    if (typeof profile.isActive !== 'boolean') {
      errors.push({
        field: `${fieldPrefix}.isActive`,
        message: 'Profile isActive must be a boolean',
        value: profile.isActive
      });
    }

    // Validate config is present
    if (!profile.config) {
      errors.push({
        field: `${fieldPrefix}.config`,
        message: 'Profile must have a config object',
        value: profile.config
      });
      return errors;
    }

    // Validate nested config
    if (typeof profile.config !== 'object') {
      errors.push({
        field: `${fieldPrefix}.config`,
        message: 'Profile config must be an object',
        value: profile.config
      });
    } else {
      const configErrors = this.validateConfig(profile.config);
      errors.push(...configErrors.map(error => ({
        ...error,
        field: `${fieldPrefix}.config.${error.field}`
      })));
    }

    return errors;
  }

  /**
   * Sanitize configuration by applying defaults for invalid values
   */
  private sanitizeConfig(config: any): UserConfig {
    const sanitized = { ...StorageManager.DEFAULT_CONFIG };

    // Sanitize each field
    if (typeof config.tabLimit === 'number' && config.tabLimit >= 1 && config.tabLimit <= 1000) {
      sanitized.tabLimit = config.tabLimit;
    }

    if (typeof config.autoCloseEnabled === 'boolean') {
      sanitized.autoCloseEnabled = config.autoCloseEnabled;
    }

    if (typeof config.autoCloseDelay === 'number' && config.autoCloseDelay >= 1 && config.autoCloseDelay <= 1440) {
      sanitized.autoCloseDelay = config.autoCloseDelay;
    }

    if (['light', 'dark', 'auto'].includes(config.theme)) {
      sanitized.theme = config.theme;
    }

    if (typeof config.notificationsEnabled === 'boolean') {
      sanitized.notificationsEnabled = config.notificationsEnabled;
    }

    if (Array.isArray(config.rules)) {
      sanitized.rules = config.rules.filter((rule: any) => 
        this.validateTabRule(rule, 'rule').length === 0
      );
    }

    if (Array.isArray(config.profiles)) {
      sanitized.profiles = config.profiles.filter((profile: any) => 
        this.validateUserProfile(profile, 'profile').length === 0
      );
    }

    return sanitized;
  }

  /**
   * Check if migration is needed and perform it
   */
  private async migrateIfNeeded(): Promise<MigrationResult | null> {
    try {
      const currentVersion = await this.getConfigVersion();
      
      if (currentVersion === StorageManager.CURRENT_VERSION) {
        return null; // No migration needed
      }

      console.log(`StorageManager: Migrating from version ${currentVersion} to ${StorageManager.CURRENT_VERSION}`);
      
      const migrationResult: MigrationResult = {
        success: true,
        fromVersion: currentVersion,
        toVersion: StorageManager.CURRENT_VERSION,
        errors: []
      };

      // Perform version-specific migrations
      try {
        await this.performMigration(currentVersion, StorageManager.CURRENT_VERSION);
        await this.setConfigVersion(StorageManager.CURRENT_VERSION);
      } catch (error) {
        migrationResult.success = false;
        migrationResult.errors.push(error instanceof Error ? error.message : String(error));
      }

      return migrationResult;
    } catch (error) {
      console.error('StorageManager: Migration check failed:', error);
      return {
        success: false,
        fromVersion: 'unknown',
        toVersion: StorageManager.CURRENT_VERSION,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Perform actual migration between versions
   * Handles version-specific migrations and ensures data consistency
   * 
   * @param fromVersion - The current version of the configuration
   * @param toVersion - The target version to migrate to
   * @returns Promise that resolves when migration is complete
   */
  private async performMigration(fromVersion: string, toVersion: string): Promise<void> {
    // Get current configuration
    const config = await this.getUserConfig();
    if (!config) {
      console.log('StorageManager: No configuration found to migrate');
      return;
    }

    const migratedFields: string[] = [];
    
    // Version-specific migrations
    if (this.compareVersions(fromVersion, '0.9.0') <= 0 && this.compareVersions(toVersion, '1.0.0') >= 0) {
      // Migration from 0.9.0 to 1.0.0
      
      // Example: Add new fields with default values if they don't exist
      if (config.autoCloseDelay === undefined) {
        config.autoCloseDelay = 30;
        migratedFields.push('autoCloseDelay');
      }
      
      // Example: Ensure rules have the correct structure
      if (Array.isArray(config.rules)) {
        config.rules = config.rules.map(rule => {
          // Ensure rule has condition and action objects
          if (!rule.condition) {
            rule.condition = {
              type: 'domain',
              operator: 'contains',
              value: '*'
            };
            migratedFields.push('rules[].condition');
          }
          
          if (!rule.action) {
            rule.action = {
              type: 'limit_tabs',
              value: config.tabLimit || 10
            };
            migratedFields.push('rules[].action');
          }
          
          return rule;
        });
      }
    }
    
    // Validate and sanitize the migrated configuration
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      console.warn('StorageManager: Validation errors after migration:', validationErrors);
      const sanitizedConfig = this.sanitizeConfig(config);
      await chrome.storage.sync.set({ [StorageManager.CONFIG_KEY]: sanitizedConfig });
      console.log('StorageManager: Configuration sanitized during migration');
    } else {
      // Save the migrated configuration
      await chrome.storage.sync.set({ [StorageManager.CONFIG_KEY]: config });
      console.log(`StorageManager: Migration completed from ${fromVersion} to ${toVersion}`);
    }
  }
  
  /**
   * Compare two semantic version strings
   * Returns negative if v1 < v2, positive if v1 > v2, 0 if equal
   * 
   * @param v1 - First version string (e.g., "1.0.0")
   * @param v2 - Second version string (e.g., "1.1.0")
   * @returns Comparison result: negative, positive, or zero
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = i < parts1.length ? parts1[i] : 0;
      const part2 = i < parts2.length ? parts2[i] : 0;
      
      if (part1 !== part2) {
        return part1 - part2;
      }
    }
    
    return 0;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      await this.createBackup();
      await this.setUserConfig(StorageManager.DEFAULT_CONFIG);
      await this.setConfigVersion(StorageManager.CURRENT_VERSION);
      console.log('StorageManager: Configuration reset to defaults');
    } catch (error) {
      console.error('StorageManager: Failed to reset configuration:', error);
      throw new Error(`Failed to reset configuration: ${error}`);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ bytesInUse: number; quota: number }> {
    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      const quota = chrome.storage.sync.QUOTA_BYTES;
      return { bytesInUse, quota };
    } catch (error) {
      console.error('StorageManager: Failed to get storage stats:', error);
      return { bytesInUse: 0, quota: 0 };
    }
  }

  /**
   * Export configuration to JSON string
   * Useful for backup and sharing configurations
   * 
   * @returns JSON string of current configuration
   */
  async exportConfig(): Promise<string> {
    try {
      const config = await this.getUserConfig();
      if (!config) {
        throw new Error('No configuration found to export');
      }

      const exportData = {
        config,
        version: await this.getConfigVersion(),
        exportDate: new Date().toISOString()
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('StorageManager: Failed to export configuration:', error);
      throw new Error(`Failed to export configuration: ${error}`);
    }
  }

  /**
   * Import configuration from JSON string
   * Validates the imported data before applying
   * 
   * @param jsonData - JSON string containing configuration data
   * @returns Success status and any validation messages
   */
  async importConfig(jsonData: string): Promise<{ success: boolean; messages: string[] }> {
    try {
      // Parse and validate the JSON data
      let importData;
      try {
        importData = JSON.parse(jsonData);
      } catch (error) {
        return { 
          success: false, 
          messages: ['Invalid JSON format'] 
        };
      }

      // Check if the import data has the expected structure
      if (!importData.config || typeof importData.config !== 'object') {
        return { 
          success: false, 
          messages: ['Import data missing valid configuration object'] 
        };
      }

      // Validate the configuration
      const validationErrors = this.validateConfig(importData.config);
      if (validationErrors.length > 0) {
        return { 
          success: false, 
          messages: [
            'Configuration validation failed:',
            ...validationErrors.map(e => `${e.field}: ${e.message}`)
          ] 
        };
      }

      // Create backup before importing
      await this.createBackup();

      // Apply the imported configuration
      await this.setUserConfig(importData.config);
      
      // Set version if provided, otherwise use current version
      const version = importData.version || StorageManager.CURRENT_VERSION;
      await this.setConfigVersion(version);

      return { 
        success: true, 
        messages: ['Configuration imported successfully'] 
      };
    } catch (error) {
      console.error('StorageManager: Failed to import configuration:', error);
      return { 
        success: false, 
        messages: [`Import failed: ${error instanceof Error ? error.message : String(error)}`] 
      };
    }
  }

  /**
   * Clear all stored data
   * Use with caution - this will delete all user settings
   * 
   * @returns Promise that resolves when operation is complete
   */
  async clearAllData(): Promise<void> {
    try {
      // Create backup before clearing
      await this.createBackup();
      
      // Clear sync storage
      await chrome.storage.sync.clear();
      
      // Reinitialize with defaults
      await this.initialize();
      
      console.log('StorageManager: All data cleared and reinitialized');
    } catch (error) {
      console.error('StorageManager: Failed to clear data:', error);
      throw new Error(`Failed to clear data: ${error}`);
    }
  }

  /**
   * Get all available backups
   * 
   * @returns List of available backups with metadata
   */
  async getBackups(): Promise<Array<{ timestamp: string; version: string }>> {
    try {
      const result = await chrome.storage.local.get(StorageManager.BACKUP_KEY);
      const backup = result[StorageManager.BACKUP_KEY];
      
      if (!backup) {
        return [];
      }
      
      return [{
        timestamp: backup.timestamp,
        version: backup.version
      }];
    } catch (error) {
      console.error('StorageManager: Failed to get backups:', error);
      return [];
    }
  }
}