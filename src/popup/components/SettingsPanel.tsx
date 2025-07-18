import React, { useState, useEffect } from 'react';
import { StorageManager } from '@/shared/StorageManager';
import { UserConfig } from '@/shared/types';
import TabLimitSettings from './TabLimitSettings';
import ThemeSelector from './ThemeSelector';
import NotificationSettings from './NotificationSettings';
import AutoCloseSettings from './AutoCloseSettings';
import FocusModeSettings from './FocusModeSettings';

interface SettingsPanelProps {
  className?: string;
  onSettingsChange?: (config: Partial<UserConfig>) => void;
  isPremium?: boolean;
}

// Extended notification preferences interface
interface NotificationPreferences {
  enabled: boolean;
  tabLimitReached: boolean;
  tabsAutoClosed: boolean;
  inactiveTabsReminder: boolean;
  sound: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  className = '',
  onSettingsChange,
  isPremium = false
}) => {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    enabled: true,
    tabLimitReached: true,
    tabsAutoClosed: true,
    inactiveTabsReminder: false,
    sound: false
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [storageManager] = useState<StorageManager>(new StorageManager());
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load main user config
      const userConfig = await storageManager.getUserConfig();
      setConfig(userConfig || {
        tabLimit: 25,
        autoCloseEnabled: false,
        autoCloseDelay: 30,
        theme: 'auto',
        notificationsEnabled: true,
        rules: [],
        profiles: []
      });
      
      // Load additional notification preferences from local storage
      try {
        const result = await chrome.storage.local.get('notificationPreferences');
        if (result.notificationPreferences) {
          setNotificationPreferences({
            enabled: userConfig?.notificationsEnabled ?? true,
            tabLimitReached: result.notificationPreferences.tabLimitReached ?? true,
            tabsAutoClosed: result.notificationPreferences.tabsAutoClosed ?? true,
            inactiveTabsReminder: result.notificationPreferences.inactiveTabsReminder ?? false,
            sound: result.notificationPreferences.sound ?? false
          });
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        // Continue with defaults
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabLimitChange = (newLimit: number) => {
    if (config) {
      const updatedConfig = { ...config, tabLimit: newLimit };
      setConfig(updatedConfig);
      if (onSettingsChange) {
        onSettingsChange({ tabLimit: newLimit });
      }
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    if (config) {
      const updatedConfig = { ...config, theme: newTheme };
      setConfig(updatedConfig);
      if (onSettingsChange) {
        onSettingsChange({ theme: newTheme });
      }
    }
  };

  const handleNotificationSettingChange = (preferences: NotificationPreferences) => {
    if (config) {
      // Update main config with enabled state
      const updatedConfig = { ...config, notificationsEnabled: preferences.enabled };
      setConfig(updatedConfig);
      
      // Update notification preferences
      setNotificationPreferences(preferences);
      
      // Notify parent component if callback provided
      if (onSettingsChange) {
        onSettingsChange({ notificationsEnabled: preferences.enabled });
      }
    }
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className={`settings-panel ${className} p-4`}>
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`settings-panel ${className} p-4`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
          <div className="flex items-center">
            <div className="text-red-500 dark:text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading settings</h3>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        </div>
        <button 
          onClick={loadConfig}
          className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`settings-panel ${className}`}>
      <div className="space-y-6">
        {config && (
          <>
            {/* Tab Limit Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button 
                className="w-full px-4 py-3 text-left flex justify-between items-center focus:outline-none"
                onClick={() => toggleSection('tabLimit')}
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">Tab Limit</span>
                <svg 
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${activeSection === 'tabLimit' ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`px-4 pb-4 ${activeSection === 'tabLimit' ? 'block' : 'hidden'}`}>
                <TabLimitSettings 
                  initialTabLimit={config.tabLimit} 
                  onTabLimitChange={handleTabLimitChange}
                  isPremium={isPremium}
                />
              </div>
            </div>
            
            {/* Theme Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button 
                className="w-full px-4 py-3 text-left flex justify-between items-center focus:outline-none"
                onClick={() => toggleSection('theme')}
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">Appearance</span>
                <svg 
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${activeSection === 'theme' ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`px-4 pb-4 ${activeSection === 'theme' ? 'block' : 'hidden'}`}>
                <ThemeSelector 
                  initialTheme={config.theme} 
                  onThemeChange={handleThemeChange} 
                />
              </div>
            </div>
            
            {/* Notification Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button 
                className="w-full px-4 py-3 text-left flex justify-between items-center focus:outline-none"
                onClick={() => toggleSection('notifications')}
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">Notifications</span>
                <svg 
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${activeSection === 'notifications' ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`px-4 pb-4 ${activeSection === 'notifications' ? 'block' : 'hidden'}`}>
                <NotificationSettings 
                  initialEnabled={config.notificationsEnabled}
                  initialPreferences={notificationPreferences}
                  onSettingChange={handleNotificationSettingChange} 
                />
              </div>
            </div>
            
            {/* Auto-Close Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button 
                className="w-full px-4 py-3 text-left flex justify-between items-center focus:outline-none"
                onClick={() => toggleSection('autoClose')}
              >
                <div className="flex items-center">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Auto-Close</span>
                  {isPremium ? null : (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 rounded-full">
                      Premium
                    </span>
                  )}
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${activeSection === 'autoClose' ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`${activeSection === 'autoClose' ? 'block' : 'hidden'}`}>
                {isPremium ? (
                  <AutoCloseSettings 
                    onClose={() => toggleSection('autoClose')}
                  />
                ) : (
                  <div className="text-center py-4 px-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Upgrade to premium to automatically close inactive tabs and save system resources.
                    </p>
                    <button className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-md shadow-sm hover:from-yellow-500 hover:to-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2">
                      Upgrade to Premium
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Focus Mode Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button 
                className="w-full px-4 py-3 text-left flex justify-between items-center focus:outline-none"
                onClick={() => toggleSection('focusMode')}
              >
                <div className="flex items-center">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Focus Mode</span>
                  {isPremium ? null : (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 rounded-full">
                      Premium
                    </span>
                  )}
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${activeSection === 'focusMode' ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className={`${activeSection === 'focusMode' ? 'block' : 'hidden'}`}>
                {isPremium ? (
                  <FocusModeSettings 
                    onClose={() => toggleSection('focusMode')}
                  />
                ) : (
                  <div className="text-center py-4 px-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Upgrade to premium to use Focus Mode with stricter tab limits and distraction blocking.
                    </p>
                    <button className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-md shadow-sm hover:from-yellow-500 hover:to-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2">
                      Upgrade to Premium
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;