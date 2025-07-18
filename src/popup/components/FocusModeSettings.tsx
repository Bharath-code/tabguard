import React, { useState, useEffect } from 'react';
import { FocusModeSettings as FocusModeSettingsType } from '../../background/FocusModeManager';

interface FocusModeSettingsProps {
  onClose?: () => void;
}

const FocusModeSettings: React.FC<FocusModeSettingsProps> = ({ onClose }) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [settings, setSettings] = useState<FocusModeSettingsType | null>(null);
  const [duration, setDuration] = useState<number>(25);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState<string>('');
  
  // Available categories
  const categories = [
    { id: 'social', label: 'Social Media' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'news', label: 'News' }
  ];
  
  // Duration presets (in minutes)
  const durationPresets = [
    { value: 25, label: '25 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 0, label: 'Indefinite' }
  ];

  // Load focus mode settings on component mount
  useEffect(() => {
    loadFocusModeSettings();
  }, []);

  // Load focus mode settings from background script
  const loadFocusModeSettings = async () => {
    try {
      setLoading(true);
      
      // Check if focus mode is active
      const activeResponse = await chrome.runtime.sendMessage({ action: 'isFocusModeActive' });
      setIsActive(activeResponse.active);
      
      // Get current settings
      const settingsResponse = await chrome.runtime.sendMessage({ action: 'getFocusModeSettings' });
      
      if (settingsResponse.settings) {
        setSettings(settingsResponse.settings);
        setDuration(settingsResponse.settings.duration);
        setBlockedCategories(settingsResponse.settings.blockedCategories || []);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading focus mode settings:', err);
      setError('Failed to load focus mode settings');
      setLoading(false);
    }
  };

  // Toggle focus mode on/off
  const toggleFocusMode = async () => {
    try {
      if (isActive) {
        // Stop focus mode
        const response = await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
        if (response.success) {
          setIsActive(false);
        } else {
          setError('Failed to stop focus mode');
        }
      } else {
        // Start focus mode with current settings
        const updatedSettings = {
          tabLimit: settings?.tabLimit || 5,
          blockDistractions: settings?.blockDistractions || true,
          blockedCategories,
          blockedDomains: settings?.blockedDomains || [],
          allowTemporaryAccess: settings?.allowTemporaryAccess || true,
          temporaryAccessDuration: settings?.temporaryAccessDuration || 5
        };
        
        const response = await chrome.runtime.sendMessage({ 
          action: 'startFocusMode',
          duration,
          settings: updatedSettings
        });
        
        if (response.success) {
          setIsActive(true);
        } else {
          setError('Failed to start focus mode');
        }
      }
    } catch (err) {
      console.error('Error toggling focus mode:', err);
      setError('Failed to toggle focus mode');
    }
  };

  // Update focus mode settings
  const updateSettings = async (updates: Partial<FocusModeSettingsType>) => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateFocusModeSettings',
        settings: updates
      });
      
      if (response.success) {
        setSettings(prev => prev ? { ...prev, ...updates } : null);
      } else {
        setError('Failed to update focus mode settings');
      }
    } catch (err) {
      console.error('Error updating focus mode settings:', err);
      setError('Failed to update settings');
    }
  };

  // Toggle category in blocked categories list
  const toggleCategory = (categoryId: string) => {
    const newBlockedCategories = blockedCategories.includes(categoryId)
      ? blockedCategories.filter(id => id !== categoryId)
      : [...blockedCategories, categoryId];
    
    setBlockedCategories(newBlockedCategories);
    updateSettings({ blockedCategories: newBlockedCategories });
  };

  // Add custom domain to blocked domains
  const addBlockedDomain = () => {
    if (!customDomain || !settings) return;
    
    const domain = customDomain.trim().toLowerCase();
    if (!domain) return;
    
    // Simple domain validation
    if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
      setError('Please enter a valid domain (e.g., facebook.com)');
      return;
    }
    
    const newBlockedDomains = [...(settings.blockedDomains || []), domain];
    updateSettings({ blockedDomains: newBlockedDomains });
    setCustomDomain('');
  };

  // Remove domain from blocked domains
  const removeBlockedDomain = (domain: string) => {
    if (!settings) return;
    
    const newBlockedDomains = (settings.blockedDomains || []).filter(d => d !== domain);
    updateSettings({ blockedDomains: newBlockedDomains });
  };

  // Update tab limit
  const updateTabLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      updateSettings({ tabLimit: value });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading focus mode settings...</div>;
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Focus Mode</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
          <button 
            className="ml-2 text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300">Focus Mode</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={isActive}
              onChange={toggleFocusMode}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isActive 
            ? 'Focus mode is active. Distractions are being limited.' 
            : 'Enable focus mode to limit distractions and improve productivity.'}
        </p>
      </div>
      
      {settings && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {durationPresets.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setDuration(preset.value);
                    if (isActive) {
                      updateSettings({ duration: preset.value });
                    }
                  }}
                  className={`px-3 py-1 text-sm rounded-full ${
                    duration === preset.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tab Limit During Focus
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.tabLimit}
              onChange={updateTabLimit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Maximum number of tabs allowed during focus mode
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Block Distracting Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={`px-3 py-1 text-sm rounded-full ${
                    blockedCategories.includes(category.id)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Block Custom Domains
            </label>
            <div className="flex">
              <input
                type="text"
                placeholder="e.g., facebook.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={addBlockedDomain}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
            
            {settings.blockedDomains && settings.blockedDomains.length > 0 && (
              <div className="mt-2">
                <ul className="space-y-1">
                  {settings.blockedDomains.map(domain => (
                    <li key={domain} className="flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{domain}</span>
                      <button
                        onClick={() => removeBlockedDomain(domain)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <div className="flex items-center">
              <input
                id="allow-temporary-access"
                type="checkbox"
                checked={settings.allowTemporaryAccess}
                onChange={(e) => updateSettings({ allowTemporaryAccess: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="allow-temporary-access" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Allow temporary access to blocked sites
              </label>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              When enabled, you can temporarily access blocked sites for a limited time
            </p>
          </div>
          
          {settings.allowTemporaryAccess && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temporary Access Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.temporaryAccessDuration}
                onChange={(e) => updateSettings({ temporaryAccessDuration: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          )}
        </>
      )}
      
      <div className="mt-6">
        <button
          onClick={toggleFocusMode}
          className={`w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isActive
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
          }`}
        >
          {isActive ? 'End Focus Session' : 'Start Focus Session'}
        </button>
      </div>
    </div>
  );
};

export default FocusModeSettings;