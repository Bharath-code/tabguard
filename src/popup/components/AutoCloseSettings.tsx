import React, { useState, useEffect } from 'react';
import { WhitelistEntry } from '../../background/AutoCloseManager';

interface AutoCloseSettingsProps {
  onClose?: () => void;
}

interface AutoCloseOptions {
  enabled: boolean;
  inactivityThreshold: number;
  maxTabsToClose: number;
  showNotifications: boolean;
  notificationDelay: number;
  excludePinnedTabs: boolean;
  excludeWorkTabs: boolean;
}

interface ClosedTabInfo {
  tabId: number;
  title: string;
  url: string;
  closedAt: Date;
  inactiveMinutes: number;
}

const AutoCloseSettings: React.FC<AutoCloseSettingsProps> = ({ onClose }) => {
  // State for auto-close options
  const [options, setOptions] = useState<AutoCloseOptions>({
    enabled: false,
    inactivityThreshold: 30,
    maxTabsToClose: 3,
    showNotifications: true,
    notificationDelay: 30,
    excludePinnedTabs: true,
    excludeWorkTabs: true
  });

  // State for whitelist
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [newWhitelistEntry, setNewWhitelistEntry] = useState({
    type: 'domain',
    value: '',
    name: ''
  });

  // State for closed tabs history
  const [closedTabs, setClosedTabs] = useState<ClosedTabInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  // Load options and whitelist on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load auto-close options
        const optionsResponse = await chrome.runtime.sendMessage({ action: 'getAutoCloseOptions' });
        if (optionsResponse && optionsResponse.options) {
          setOptions(optionsResponse.options);
        }
        
        // Load whitelist
        const whitelistResponse = await chrome.runtime.sendMessage({ action: 'getWhitelist' });
        if (whitelistResponse && whitelistResponse.whitelist) {
          setWhitelist(whitelistResponse.whitelist);
        }
        
        // Load closed tabs history
        const closedTabsResponse = await chrome.runtime.sendMessage({ action: 'getClosedTabs' });
        if (closedTabsResponse && closedTabsResponse.closedTabs) {
          setClosedTabs(closedTabsResponse.closedTabs.map((tab: any) => ({
            ...tab,
            closedAt: new Date(tab.closedAt)
          })));
        }
      } catch (error) {
        console.error('Error loading auto-close data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle option changes
  const handleOptionChange = (key: keyof AutoCloseOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  // Save options
  const saveOptions = async () => {
    try {
      setSaveStatus('Saving...');
      const response = await chrome.runtime.sendMessage({
        action: 'updateAutoCloseOptions',
        options
      });
      
      if (response && response.success) {
        setSaveStatus('Saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Error saving settings');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error saving auto-close options:', error);
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Add to whitelist
  const addToWhitelist = async () => {
    if (!newWhitelistEntry.value) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'addToWhitelist',
        entry: newWhitelistEntry
      });
      
      if (response && response.success) {
        // Refresh whitelist
        const whitelistResponse = await chrome.runtime.sendMessage({ action: 'getWhitelist' });
        if (whitelistResponse && whitelistResponse.whitelist) {
          setWhitelist(whitelistResponse.whitelist);
        }
        
        // Clear input
        setNewWhitelistEntry({
          type: 'domain',
          value: '',
          name: ''
        });
      }
    } catch (error) {
      console.error('Error adding to whitelist:', error);
    }
  };

  // Remove from whitelist
  const removeFromWhitelist = async (type: string, value: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'removeFromWhitelist',
        type,
        value
      });
      
      if (response && response.success) {
        // Refresh whitelist
        const whitelistResponse = await chrome.runtime.sendMessage({ action: 'getWhitelist' });
        if (whitelistResponse && whitelistResponse.whitelist) {
          setWhitelist(whitelistResponse.whitelist);
        }
      }
    } catch (error) {
      console.error('Error removing from whitelist:', error);
    }
  };

  // Undo last closure
  const undoLastClosure = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'undoLastClosure' });
      
      if (response && response.success) {
        // Refresh closed tabs
        const closedTabsResponse = await chrome.runtime.sendMessage({ action: 'getClosedTabs' });
        if (closedTabsResponse && closedTabsResponse.closedTabs) {
          setClosedTabs(closedTabsResponse.closedTabs.map((tab: any) => ({
            ...tab,
            closedAt: new Date(tab.closedAt)
          })));
        }
      }
    } catch (error) {
      console.error('Error undoing last closure:', error);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Format domain for display
  const formatDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  };

  if (loading) {
    return <div className="p-4">Loading auto-close settings...</div>;
  }

  return (
    <div className="p-4 max-h-[500px] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Auto-Close Settings</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="font-medium">Enable Auto-Close</label>
          <div className="relative inline-block w-12 align-middle select-none">
            <input
              type="checkbox"
              id="toggle-auto-close"
              checked={options.enabled}
              onChange={(e) => handleOptionChange('enabled', e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
            />
            <label
              htmlFor="toggle-auto-close"
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                options.enabled ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            ></label>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block font-medium mb-1">
            Auto-close after inactivity (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="1440"
            value={options.inactivityThreshold}
            onChange={(e) => handleOptionChange('inactivityThreshold', parseInt(e.target.value) || 30)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block font-medium mb-1">
            Maximum tabs to close at once
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={options.maxTabsToClose}
            onChange={(e) => handleOptionChange('maxTabsToClose', parseInt(e.target.value) || 3)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="show-notifications"
            checked={options.showNotifications}
            onChange={(e) => handleOptionChange('showNotifications', e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="show-notifications">Show notifications before closing tabs</label>
        </div>
        
        {options.showNotifications && (
          <div className="mb-4 ml-6">
            <label className="block font-medium mb-1">
              Notification delay before closing (seconds)
            </label>
            <input
              type="number"
              min="5"
              max="300"
              value={options.notificationDelay}
              onChange={(e) => handleOptionChange('notificationDelay', parseInt(e.target.value) || 30)}
              className="w-full p-2 border rounded"
            />
          </div>
        )}
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="exclude-pinned"
            checked={options.excludePinnedTabs}
            onChange={(e) => handleOptionChange('excludePinnedTabs', e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="exclude-pinned">Exclude pinned tabs from auto-close</label>
        </div>
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="exclude-work"
            checked={options.excludeWorkTabs}
            onChange={(e) => handleOptionChange('excludeWorkTabs', e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="exclude-work">Exclude work-related tabs from auto-close</label>
        </div>
        
        <button
          onClick={saveOptions}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Save Settings
        </button>
        
        {saveStatus && (
          <span className="ml-2 text-sm text-green-600">{saveStatus}</span>
        )}
      </div>
      
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-2">Whitelist</h3>
        <p className="text-sm text-gray-600 mb-2">
          Whitelisted domains and URLs will never be auto-closed
        </p>
        
        <div className="flex mb-2">
          <select
            value={newWhitelistEntry.type}
            onChange={(e) => setNewWhitelistEntry({...newWhitelistEntry, type: e.target.value as any})}
            className="p-2 border rounded mr-2"
          >
            <option value="domain">Domain</option>
            <option value="url">Exact URL</option>
            <option value="pattern">Pattern (Regex)</option>
          </select>
          
          <input
            type="text"
            placeholder={newWhitelistEntry.type === 'domain' ? 'example.com' : 
              newWhitelistEntry.type === 'url' ? 'https://example.com/page' : '.*\\.example\\.com'}
            value={newWhitelistEntry.value}
            onChange={(e) => setNewWhitelistEntry({...newWhitelistEntry, value: e.target.value})}
            className="p-2 border rounded flex-grow mr-2"
          />
          
          <button
            onClick={addToWhitelist}
            disabled={!newWhitelistEntry.value}
            className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded disabled:opacity-50"
          >
            Add
          </button>
        </div>
        
        <div className="text-sm mb-2">
          <input
            type="text"
            placeholder="Optional name for this entry"
            value={newWhitelistEntry.name}
            onChange={(e) => setNewWhitelistEntry({...newWhitelistEntry, name: e.target.value})}
            className="p-2 border rounded w-full"
          />
        </div>
        
        {whitelist.length > 0 ? (
          <ul className="max-h-40 overflow-y-auto border rounded p-2">
            {whitelist.map((entry, index) => (
              <li key={index} className="flex justify-between items-center py-1 border-b last:border-b-0">
                <div>
                  <span className="font-medium">{entry.name || entry.value}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({entry.type})
                  </span>
                </div>
                <button
                  onClick={() => removeFromWhitelist(entry.type, entry.value)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No whitelist entries yet</p>
        )}
      </div>
      
      {closedTabs.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-semibold">Recently Closed Tabs</h3>
            <button
              onClick={undoLastClosure}
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded"
            >
              Undo Last Closure
            </button>
          </div>
          
          <ul className="max-h-40 overflow-y-auto border rounded p-2">
            {closedTabs.map((tab, index) => (
              <li key={index} className="text-sm py-1 border-b last:border-b-0">
                <div className="font-medium truncate" title={tab.title}>
                  {tab.title || 'Untitled Tab'}
                </div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{formatDomain(tab.url)}</span>
                  <span>Closed: {formatDate(tab.closedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AutoCloseSettings;