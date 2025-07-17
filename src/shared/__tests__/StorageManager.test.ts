// Tests for StorageManager
// Comprehensive test suite covering all storage operations

import { StorageManager, StorageValidationError, MigrationResult } from '../StorageManager';
import { UserConfig, TabRule, UserProfile } from '../types';

// Mock Chrome storage API
const mockChromeStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
    getBytesInUse: jest.fn(),
    clear: jest.fn(),
    QUOTA_BYTES: 102400
  },
  local: {
    get: jest.fn(),
    set: jest.fn()
  }
};

// Mock chrome global
(global as any).chrome = {
  storage: mockChromeStorage
};

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with default configuration when no config exists', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await storageManager.initialize();

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: {
          tabLimit: 10,
          autoCloseEnabled: false,
          autoCloseDelay: 30,
          theme: 'auto',
          notificationsEnabled: true,
          rules: [],
          profiles: []
        }
      });
    });

    it('should not overwrite existing valid configuration', async () => {
      const existingConfig: UserConfig = {
        tabLimit: 15,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark',
        notificationsEnabled: false,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: existingConfig })
        .mockResolvedValueOnce({ configVersion: '1.0.0' });

      await storageManager.initialize();

      expect(mockChromeStorage.sync.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ userConfig: expect.anything() })
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockChromeStorage.sync.get.mockRejectedValue(new Error('Storage error'));

      await expect(storageManager.initialize()).rejects.toThrow('Storage initialization failed');
    });
  });

  describe('getUserConfig', () => {
    it('should return null when no configuration exists', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});

      const result = await storageManager.getUserConfig();

      expect(result).toBeNull();
    });

    it('should return valid configuration', async () => {
      const validConfig: UserConfig = {
        tabLimit: 20,
        autoCloseEnabled: true,
        autoCloseDelay: 60,
        theme: 'light',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get.mockResolvedValue({ userConfig: validConfig });

      const result = await storageManager.getUserConfig();

      expect(result).toEqual(validConfig);
    });

    it('should sanitize invalid configuration', async () => {
      const invalidConfig = {
        tabLimit: -5, // Invalid
        autoCloseEnabled: 'not a boolean', // Invalid
        autoCloseDelay: 30,
        theme: 'invalid-theme', // Invalid
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get.mockResolvedValue({ userConfig: invalidConfig });

      const result = await storageManager.getUserConfig();

      expect(result).toEqual({
        tabLimit: 10, // Default
        autoCloseEnabled: false, // Default
        autoCloseDelay: 30,
        theme: 'auto', // Default
        notificationsEnabled: true,
        rules: [],
        profiles: []
      });
    });

    it('should handle storage errors', async () => {
      mockChromeStorage.sync.get.mockRejectedValue(new Error('Storage error'));

      await expect(storageManager.getUserConfig()).rejects.toThrow('Failed to retrieve configuration');
    });
  });

  describe('setUserConfig', () => {
    it('should save valid configuration', async () => {
      const validConfig: UserConfig = {
        tabLimit: 25,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark',
        notificationsEnabled: false,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get.mockResolvedValue({}); // No existing config for backup
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageManager.setUserConfig(validConfig);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: validConfig
      });
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        tabLimit: -1, // Invalid
        autoCloseEnabled: true,
        autoCloseDelay: 30,
        theme: 'dark',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(invalidConfig)).rejects.toThrow('Configuration validation failed');
    });

    it('should create backup before saving', async () => {
      const existingConfig: UserConfig = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      const newConfig: UserConfig = {
        tabLimit: 15,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark',
        notificationsEnabled: false,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: existingConfig }) // For backup
        .mockResolvedValueOnce({ configVersion: '1.0.0' }); // For backup version
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageManager.setUserConfig(newConfig);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        configBackup: expect.objectContaining({
          config: existingConfig,
          timestamp: expect.any(String),
          version: '1.0.0'
        })
      });
    });
  });

  describe('updateConfigField', () => {
    it('should update specific configuration field', async () => {
      const existingConfig: UserConfig = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: existingConfig }) // Get current config
        .mockResolvedValueOnce({}) // For backup (no existing config)
        .mockResolvedValueOnce({ configVersion: '1.0.0' }); // For backup version
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageManager.updateConfigField('tabLimit', 25);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: {
          ...existingConfig,
          tabLimit: 25
        }
      });
    });

    it('should throw error when no configuration exists', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});

      await expect(storageManager.updateConfigField('tabLimit', 25))
        .rejects.toThrow('No configuration found to update');
    });
  });

  describe('validation', () => {
    it('should validate tab limit bounds', async () => {
      const configWithInvalidLimit = {
        tabLimit: 2000, // Too high
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidLimit))
        .rejects.toThrow('Tab limit must be a number between 1 and 1000');
    });

    it('should validate auto close delay bounds', async () => {
      const configWithInvalidDelay = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 2000, // Too high
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidDelay))
        .rejects.toThrow('Auto close delay must be a number between 1 and 1440 minutes');
    });

    it('should validate theme values', async () => {
      const configWithInvalidTheme = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'invalid-theme' as any,
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      await expect(storageManager.setUserConfig(configWithInvalidTheme))
        .rejects.toThrow('Theme must be one of: light, dark, auto');
    });

    it('should validate boolean fields', async () => {
      const configWithInvalidBoolean = {
        tabLimit: 10,
        autoCloseEnabled: 'not-boolean' as any,
        autoCloseDelay: 30,
        theme: 'auto' as const,
        notificationsEnabled: true,
        rules: [],
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidBoolean))
        .rejects.toThrow('Auto close enabled must be a boolean');
    });

    it('should validate rules array structure', async () => {
      const configWithInvalidRules = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto' as const,
        notificationsEnabled: true,
        rules: 'not-an-array' as any,
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidRules))
        .rejects.toThrow('Rules must be an array');
    });

    it('should validate individual tab rules', async () => {
      const invalidRule = {
        id: '', // Invalid - empty string
        name: 'Test Rule',
        condition: { type: 'domain', operator: 'equals', value: 'example.com' },
        action: { type: 'limit_tabs', value: 5 },
        priority: 1,
        enabled: true
      };

      const configWithInvalidRule = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [invalidRule],
        profiles: []
      } as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidRule))
        .rejects.toThrow('Rule ID must be a non-empty string');
    });
  });

  describe('backup and restore', () => {
    it('should restore configuration from backup', async () => {
      const backupConfig: UserConfig = {
        tabLimit: 15,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark',
        notificationsEnabled: false,
        rules: [],
        profiles: []
      };

      const backup = {
        config: backupConfig,
        timestamp: '2023-01-01T00:00:00.000Z',
        version: '1.0.0'
      };

      mockChromeStorage.local.get.mockResolvedValue({ configBackup: backup });
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      const result = await storageManager.restoreFromBackup();

      expect(result).toBe(true);
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: backupConfig
      });
    });

    it('should return false when no backup exists', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const result = await storageManager.restoreFromBackup();

      expect(result).toBe(false);
    });

    it('should handle backup restore errors', async () => {
      mockChromeStorage.local.get.mockRejectedValue(new Error('Storage error'));

      const result = await storageManager.restoreFromBackup();

      expect(result).toBe(false);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({}); // No existing config for backup
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageManager.resetToDefaults();

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: {
          tabLimit: 10,
          autoCloseEnabled: false,
          autoCloseDelay: 30,
          theme: 'auto',
          notificationsEnabled: true,
          rules: [],
          profiles: []
        }
      });
    });
  });

  describe('getStorageStats', () => {
    it('should return storage usage statistics', async () => {
      mockChromeStorage.sync.getBytesInUse.mockResolvedValue(1024);

      const stats = await storageManager.getStorageStats();

      expect(stats).toEqual({
        bytesInUse: 1024,
        quota: 102400
      });
    });

    it('should handle storage stats errors', async () => {
      mockChromeStorage.sync.getBytesInUse.mockRejectedValue(new Error('Storage error'));

      const stats = await storageManager.getStorageStats();

      expect(stats).toEqual({
        bytesInUse: 0,
        quota: 0
      });
    });
  });

  describe('migration', () => {
    it('should not migrate when versions match', async () => {
      const existingConfig: UserConfig = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: existingConfig })
        .mockResolvedValueOnce({ configVersion: '1.0.0' });

      await storageManager.initialize();

      // Should not call set for migration since versions match
      expect(mockChromeStorage.sync.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ configVersion: expect.anything() })
      );
    });

    it('should perform migration when versions differ', async () => {
      const existingConfig: UserConfig = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: existingConfig })
        .mockResolvedValueOnce({ configVersion: '0.9.0' }); // Old version
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await storageManager.initialize();

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        configVersion: '1.0.0'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null configuration gracefully', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({ userConfig: null });

      const result = await storageManager.getUserConfig();

      expect(result).toBeNull();
    });

    it('should handle undefined configuration gracefully', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({ userConfig: undefined });

      const result = await storageManager.getUserConfig();

      expect(result).toBeNull();
    });

    it('should handle corrupted configuration data', async () => {
      const corruptedConfig = 'not-an-object';
      mockChromeStorage.sync.get.mockResolvedValue({ userConfig: corruptedConfig });

      const result = await storageManager.getUserConfig();

      // Should return sanitized default config
      expect(result).toEqual({
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      });
    });

    it('should handle storage quota exceeded errors', async () => {
      const largeConfig: UserConfig = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get.mockResolvedValue({});
      mockChromeStorage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await expect(storageManager.setUserConfig(largeConfig))
        .rejects.toThrow('Failed to save configuration');
    });
  });

  describe('enhanced validation', () => {
    it('should validate tab rule condition and action', async () => {
      const configWithInvalidRule = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [{
          id: 'rule1',
          name: 'Test Rule',
          priority: 1,
          enabled: true,
          condition: {
            type: 'invalid-type', // Invalid type
            operator: 'equals',
            value: 'example.com'
          },
          action: {
            type: 'limit_tabs',
            value: 5
          }
        }],
        profiles: []
      } as unknown as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidRule))
        .rejects.toThrow('Condition type must be one of: domain, category, time, tab_count');
    });

    it('should validate user profile config', async () => {
      const configWithInvalidProfile = {
        tabLimit: 10,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: [{
          id: 'profile1',
          name: 'Test Profile',
          isActive: true,
          config: null // Invalid config
        }]
      } as unknown as UserConfig;

      await expect(storageManager.setUserConfig(configWithInvalidProfile))
        .rejects.toThrow('Profile must have a config object');
    });
  });

  describe('data migration', () => {
    it('should compare versions correctly', async () => {
      // Access private method using type assertion
      const compareVersions = (storageManager as any).compareVersions.bind(storageManager);
      
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
      expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0.0', '0.9.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
    });

    it('should migrate configuration from older versions', async () => {
      const oldConfig = {
        tabLimit: 15,
        autoCloseEnabled: true,
        // Missing autoCloseDelay
        theme: 'dark',
        notificationsEnabled: false,
        rules: [{
          id: 'rule1',
          name: 'Test Rule',
          priority: 1,
          enabled: true,
          // Missing condition and action
        }],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: oldConfig })
        .mockResolvedValueOnce({ configVersion: '0.9.0' })
        .mockResolvedValueOnce({ userConfig: oldConfig });
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await storageManager.initialize();

      // Should have called set with migrated config
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        configVersion: '1.0.0'
      });
    });
  });

  describe('import/export', () => {
    it('should export configuration to JSON', async () => {
      const testConfig: UserConfig = {
        tabLimit: 20,
        autoCloseEnabled: true,
        autoCloseDelay: 45,
        theme: 'dark',
        notificationsEnabled: false,
        rules: [],
        profiles: []
      };

      mockChromeStorage.sync.get
        .mockResolvedValueOnce({ userConfig: testConfig })
        .mockResolvedValueOnce({ configVersion: '1.0.0' });

      const exportedJson = await storageManager.exportConfig();
      const exportedData = JSON.parse(exportedJson);

      expect(exportedData.config).toEqual(testConfig);
      expect(exportedData.version).toBe('1.0.0');
      expect(exportedData.exportDate).toBeDefined();
    });

    it('should import valid configuration from JSON', async () => {
      const importData = {
        config: {
          tabLimit: 25,
          autoCloseEnabled: false,
          autoCloseDelay: 60,
          theme: 'light',
          notificationsEnabled: true,
          rules: [],
          profiles: []
        },
        version: '1.0.0',
        exportDate: new Date().toISOString()
      };

      mockChromeStorage.sync.get.mockResolvedValue({}); // No existing config for backup
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      const result = await storageManager.importConfig(JSON.stringify(importData));

      expect(result.success).toBe(true);
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: importData.config
      });
    });

    it('should reject invalid JSON during import', async () => {
      const invalidJson = '{ this is not valid JSON }';

      const result = await storageManager.importConfig(invalidJson);

      expect(result.success).toBe(false);
      expect(result.messages).toContain('Invalid JSON format');
    });

    it('should reject import with missing config', async () => {
      const invalidImport = {
        version: '1.0.0',
        exportDate: new Date().toISOString()
        // Missing config
      };

      const result = await storageManager.importConfig(JSON.stringify(invalidImport));

      expect(result.success).toBe(false);
      expect(result.messages).toContain('Import data missing valid configuration object');
    });
  });

  describe('data management', () => {
    it('should clear all data and reinitialize', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({}); // No existing config for backup
      mockChromeStorage.sync.clear.mockResolvedValue(undefined);
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageManager.clearAllData();

      expect(mockChromeStorage.sync.clear).toHaveBeenCalled();
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        userConfig: {
          tabLimit: 10,
          autoCloseEnabled: false,
          autoCloseDelay: 30,
          theme: 'auto',
          notificationsEnabled: true,
          rules: [],
          profiles: []
        }
      });
    });

    it('should get available backups', async () => {
      const backup = {
        config: {},
        timestamp: '2023-01-01T00:00:00.000Z',
        version: '1.0.0'
      };

      mockChromeStorage.local.get.mockResolvedValue({ configBackup: backup });

      const backups = await storageManager.getBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0]).toEqual({
        timestamp: backup.timestamp,
        version: backup.version
      });
    });

    it('should return empty array when no backups exist', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const backups = await storageManager.getBackups();

      expect(backups).toEqual([]);
    });
  });
});