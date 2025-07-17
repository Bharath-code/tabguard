import React, { useState, useEffect } from 'react';
import { StorageManager } from '@/shared/StorageManager';

interface NotificationPreferences {
  enabled: boolean;
  tabLimitReached: boolean;
  tabsAutoClosed: boolean;
  inactiveTabsReminder: boolean;
  sound: boolean;
}

interface NotificationSettingsProps {
  initialEnabled?: boolean;
  initialPreferences?: Partial<NotificationPreferences>;
  onSettingChange?: (preferences: NotificationPreferences) => void;
  className?: string;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  initialEnabled = true,
  initialPreferences = {},
  onSettingChange,
  className = ''
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: initialEnabled,
    tabLimitReached: initialPreferences.tabLimitReached ?? true,
    tabsAutoClosed: initialPreferences.tabsAutoClosed ?? true,
    inactiveTabsReminder: initialPreferences.inactiveTabsReminder ?? false,
    sound: initialPreferences.sound ?? false
  });

  const [storageManager] = useState<StorageManager>(new StorageManager());
  const [saving, setSaving] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    // Update local state if props change
    setPreferences(prev => ({
      ...prev,
      enabled: initialEnabled,
      ...initialPreferences
    }));

    // Check current notification permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [initialEnabled, initialPreferences]);

  const handleToggleNotifications = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    const updatedPreferences = { ...preferences, enabled: newValue };
    setPreferences(updatedPreferences);

    // Notify parent component if callback provided
    if (onSettingChange) {
      onSettingChange(updatedPreferences);
    }

    // Auto-expand options when enabling notifications
    if (newValue && !expanded) {
      setExpanded(true);

      // Request permission if enabling and not already granted
      if (permissionStatus !== 'granted') {
        requestNotificationPermission();
      }
    }
  };

  const handlePreferenceChange = (key: keyof Omit<NotificationPreferences, 'enabled'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.checked;
      const updatedPreferences = { ...preferences, [key]: newValue };
      setPreferences(updatedPreferences);

      // Notify parent component if callback provided
      if (onSettingChange) {
        onSettingChange(updatedPreferences);
      }
    };

  const saveNotificationSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save all notification preferences
      await storageManager.updateConfigField('notificationsEnabled', preferences.enabled);

      // Save additional preferences (would need to update UserConfig type to include these)
      // For now, we'll simulate this by storing in local storage
      await chrome.storage.local.set({
        notificationPreferences: {
          tabLimitReached: preferences.tabLimitReached,
          tabsAutoClosed: preferences.tabsAutoClosed,
          inactiveTabsReminder: preferences.inactiveTabsReminder,
          sound: preferences.sound
        }
      });

      // If enabling notifications, request permission if needed
      if (preferences.enabled && permissionStatus !== 'granted') {
        const newStatus = await requestNotificationPermission();
        setPermissionStatus(newStatus);
      }

      // Show success message
      setShowSuccess(true);
      setTimeout(() => {
        setSaving(false);
        setShowSuccess(false);
      }, 1500);

      return true;
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      setError('Failed to save settings. Please try again.');
      setSaving(false);
      return false;
    }
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return 'denied';
    }

    // Check if we already have permission
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // Otherwise, request permission
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission;
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return Notification.permission;
      }
    }

    return Notification.permission;
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Show a test notification
  const showTestNotification = () => {
    if (permissionStatus !== 'granted') {
      setError('Notification permission not granted. Please enable notifications first.');
      return;
    }

    try {
      // Use Chrome's extension API to show a notification through the background script
      chrome.runtime.sendMessage({
        action: 'showNotification',
        title: 'TabGuard Pro Test',
        message: 'This is a test notification from TabGuard Pro.',
        silent: !preferences.sound
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending error:', chrome.runtime.lastError);
          setError(`Failed to send message: ${chrome.runtime.lastError.message}`);
        } else if (!response || !response.success) {
          console.error('Notification failed:', response?.error || 'Unknown error');
          setError(`Failed to show notification: ${response?.error || 'Unknown error'}`);
        } else {
          console.log('Notification sent successfully with ID:', response.notificationId);
        }
      });
    } catch (error) {
      console.error('Error showing test notification:', error);
      setError('Failed to show test notification.');
    }
  };

  return (
    <div className={`notification-settings ${className}`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Notifications
          </label>

          <button
            onClick={toggleExpanded}
            className="text-xs text-primary hover:text-primary-dark dark:hover:text-primary-light focus:outline-none"
            aria-expanded={expanded}
            aria-controls="notification-options"
          >
            {expanded ? 'Hide options' : 'Show options'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="notifications-toggle"
              type="checkbox"
              checked={preferences.enabled}
              onChange={handleToggleNotifications}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
            />
            <label htmlFor="notifications-toggle" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable notifications
            </label>
          </div>

          <button
            onClick={saveNotificationSettings}
            disabled={saving}
            className={`px-3 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${showSuccess
              ? 'bg-green-500 text-white cursor-default'
              : saving
                ? 'bg-gray-400 text-white cursor-wait'
                : 'bg-primary text-white hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary'
              }`}
            aria-live="polite"
          >
            {showSuccess ? '✓ Saved!' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Permission status indicator */}
        {preferences.enabled && permissionStatus && (
          <div className={`text-xs px-2 py-1 rounded ${permissionStatus === 'granted'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : permissionStatus === 'denied'
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
            {permissionStatus === 'granted'
              ? '✓ Notification permission granted'
              : permissionStatus === 'denied'
                ? '✗ Notification permission denied. Please enable in browser settings.'
                : '! Notification permission required. Click Save to request.'}
          </div>
        )}

        {expanded && (
          <div
            id="notification-options"
            className={`pl-6 space-y-2 ${preferences.enabled ? '' : 'opacity-50 pointer-events-none'}`}
          >
            <div className="flex items-center">
              <input
                id="tab-limit-notification"
                type="checkbox"
                checked={preferences.tabLimitReached}
                onChange={handlePreferenceChange('tabLimitReached')}
                disabled={!preferences.enabled}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
              />
              <label htmlFor="tab-limit-notification" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Tab limit reached
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="auto-close-notification"
                type="checkbox"
                checked={preferences.tabsAutoClosed}
                onChange={handlePreferenceChange('tabsAutoClosed')}
                disabled={!preferences.enabled}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
              />
              <label htmlFor="auto-close-notification" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Tabs auto-closed
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="inactive-tabs-notification"
                type="checkbox"
                checked={preferences.inactiveTabsReminder}
                onChange={handlePreferenceChange('inactiveTabsReminder')}
                disabled={!preferences.enabled}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
              />
              <label htmlFor="inactive-tabs-notification" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Inactive tabs reminder
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="sound-notification"
                type="checkbox"
                checked={preferences.sound}
                onChange={handlePreferenceChange('sound')}
                disabled={!preferences.enabled}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
              />
              <label htmlFor="sound-notification" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Play sound with notifications
              </label>
            </div>

            {/* Test notification button */}
            {permissionStatus === 'granted' && preferences.enabled && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={showTestNotification}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded"
                >
                  Test notification
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {expanded
            ? 'Customize which notifications you receive and how they appear'
            : 'Receive alerts when tab limit is reached or when tabs are automatically closed'}
        </p>
      </div>
    </div>
  );
};

export default NotificationSettings;