import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserConfig, TabSuggestion } from '@/shared/types';
import TabCounter from './components/TabCounter';
import QuickActions from './components/QuickActions';
import './popup.css';

// Define CSS variables for Tailwind classes that might not be processed
const styles = {
  container: "p-4 flex flex-col h-full bg-white dark:bg-gray-900",
  header: "text-center mb-4",
  headerTitle: "text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1",
  headerSubtitle: "text-xs text-gray-600 dark:text-gray-400",
  loadingContainer: "flex items-center justify-center h-full",
  loadingText: "text-gray-600 dark:text-gray-400",
  footer: "mt-4 text-center text-xs text-gray-400 dark:text-gray-500",
  footerLink: "text-blue-600 dark:text-blue-400 cursor-pointer hover:underline",
  counterSection: "mb-4",
  actionsSection: "mb-auto"
};

const PopupApp: React.FC = () => {
  const [currentTabCount, setCurrentTabCount] = useState<number>(0);
  const [tabLimit, setTabLimit] = useState<number>(25);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabSuggestions, setTabSuggestions] = useState<TabSuggestion[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
    
    // Apply theme based on user preference or system setting
    applyTheme();
  }, []);

  const loadInitialData = async () => {
    try {
      setError(null);
      // Get current tab count
      const tabs = await chrome.tabs.query({});
      setCurrentTabCount(tabs.length);

      // Get user configuration
      const result = await chrome.storage.sync.get('userConfig');
      const config: UserConfig = result.userConfig;
      if (config) {
        setTabLimit(config.tabLimit);
        setTheme(config.theme);
      } else {
        // Initialize with default config if not found
        await chrome.storage.sync.set({
          userConfig: {
            tabLimit: 25,
            autoCloseEnabled: false,
            autoCloseDelay: 30,
            theme: 'auto',
            notificationsEnabled: true,
            rules: [],
            profiles: []
          }
        });
      }

      // Get tab suggestions from background script
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getSuggestedTabs' });
        if (response && Array.isArray(response.suggestions)) {
          setTabSuggestions(response.suggestions);
        }
      } catch (error) {
        console.error('Failed to get tab suggestions:', error);
        setTabSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to load popup data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = () => {
    // Apply theme based on user preference or system setting
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyTheme();
  }, [theme]);

  const openOptionsPage = () => {
    try {
      console.log('Opening options page...');
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Failed to open options page:', error);
      // Fallback: try to open options page manually
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  };

  const handleCloseSuggested = async () => {
    if (tabSuggestions.length === 0) return;
    
    try {
      // Send message to background script to close suggested tabs
      await chrome.runtime.sendMessage({ 
        action: 'closeSuggestedTabs',
        tabIds: tabSuggestions.map(tab => tab.tabId)
      });
      
      // Refresh data after closing tabs
      loadInitialData();
    } catch (error) {
      console.error('Failed to close suggested tabs:', error);
      setError('Failed to close suggested tabs.');
    }
  };

  const handleCloseAllDuplicates = async () => {
    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({});
      
      // Find duplicates by URL
      const urlMap = new Map<string, number[]>();
      tabs.forEach(tab => {
        if (tab.url && tab.id) {
          const url = tab.url;
          if (!urlMap.has(url)) {
            urlMap.set(url, []);
          }
          urlMap.get(url)?.push(tab.id);
        }
      });
      
      // Get duplicate tab IDs (keep the first occurrence)
      const duplicateTabIds: number[] = [];
      urlMap.forEach((tabIds) => {
        if (tabIds.length > 1) {
          // Keep the first tab, close the rest
          duplicateTabIds.push(...tabIds.slice(1));
        }
      });
      
      if (duplicateTabIds.length > 0) {
        // Close duplicate tabs
        await chrome.tabs.remove(duplicateTabIds);
        
        // Show notification
        chrome.runtime.sendMessage({ 
          action: 'showNotification',
          title: 'Duplicate Tabs Closed',
          message: `Closed ${duplicateTabIds.length} duplicate tabs`
        });
        
        // Refresh data
        loadInitialData();
      } else {
        // Show notification that no duplicates were found
        chrome.runtime.sendMessage({ 
          action: 'showNotification',
          title: 'No Duplicates Found',
          message: 'No duplicate tabs were found'
        });
      }
    } catch (error) {
      console.error('Failed to close duplicate tabs:', error);
      setError('Failed to close duplicate tabs.');
    }
  };

  const handleCloseInactiveTabs = async () => {
    try {
      // Send message to background script to close inactive tabs
      const response = await chrome.runtime.sendMessage({ action: 'closeInactiveTabs' });
      
      if (response && response.success) {
        // Refresh data after closing tabs
        loadInitialData();
      }
    } catch (error) {
      console.error('Failed to close inactive tabs:', error);
      setError('Failed to close inactive tabs.');
    }
  };

  const handleGroupTabsByDomain = async () => {
    try {
      // Check if tab groups API is available
      if (!chrome.tabGroups) {
        chrome.runtime.sendMessage({ 
          action: 'showNotification',
          title: 'Feature Not Available',
          message: 'Tab grouping is not supported in your browser version'
        });
        return;
      }
      
      // Get all tabs
      const tabs = await chrome.tabs.query({});
      
      // Group tabs by domain
      const domainMap = new Map<string, number[]>();
      tabs.forEach(tab => {
        if (tab.url && tab.id) {
          try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            if (!domainMap.has(domain)) {
              domainMap.set(domain, []);
            }
            domainMap.get(domain)?.push(tab.id);
          } catch (error) {
            console.error('Invalid URL:', tab.url);
          }
        }
      });
      
      // Create tab groups for each domain with more than one tab
      const groupPromises: Promise<void>[] = [];
      
      domainMap.forEach((tabIds, domain) => {
        if (tabIds.length > 1) {
          const promise = (async () => {
            try {
              // Create a tab group
              const groupId = await chrome.tabs.group({ tabIds });
              
              // Update the group with domain name and color
              await chrome.tabGroups.update(groupId, {
                title: domain.replace('www.', ''),
                color: getColorForDomain(domain)
              });
            } catch (error) {
              console.error(`Failed to group tabs for domain ${domain}:`, error);
            }
          })();
          
          groupPromises.push(promise);
        }
      });
      
      // Wait for all grouping operations to complete
      await Promise.all(groupPromises);
      
      // Show notification
      chrome.runtime.sendMessage({ 
        action: 'showNotification',
        title: 'Tabs Grouped',
        message: `Grouped tabs by domain`
      });
      
      // Refresh data
      loadInitialData();
    } catch (error) {
      console.error('Failed to group tabs by domain:', error);
      setError('Failed to group tabs by domain.');
    }
  };

  // Helper function to get a consistent color for a domain
  const getColorForDomain = (domain: string): chrome.tabGroups.ColorEnum => {
    const colors: chrome.tabGroups.ColorEnum[] = [
      'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
    ];
    
    // Simple hash function to get a consistent color for the same domain
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        padding: '20px'
      }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
      color: theme === 'dark' ? '#f3f4f6' : '#111827'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          color: theme === 'dark' ? '#3b82f6' : '#2563eb',
          marginBottom: '4px'
        }}>
          TabGuard Pro
        </h1>
        <p style={{ 
          fontSize: '0.75rem', 
          color: theme === 'dark' ? '#9ca3af' : '#6b7280' 
        }}>
          Intelligent Tab Management
        </p>
      </header>

      {error && (
        <div style={{
          padding: '8px',
          marginBottom: '12px',
          backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
          color: theme === 'dark' ? '#f87171' : '#dc2626',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <TabCounter 
          currentCount={currentTabCount} 
          tabLimit={tabLimit} 
        />
      </div>

      <div style={{ marginBottom: 'auto' }}>
        <QuickActions 
          onOpenSettings={openOptionsPage}
          onCloseSuggested={handleCloseSuggested}
          hasSuggestions={tabSuggestions.length > 0}
          onCloseAllDuplicates={handleCloseAllDuplicates}
          onCloseInactiveTabs={handleCloseInactiveTabs}
          onGroupTabsByDomain={handleGroupTabsByDomain}
        />
      </div>

      <footer style={{ 
        marginTop: '16px', 
        textAlign: 'center', 
        fontSize: '0.75rem',
        color: theme === 'dark' ? '#9ca3af' : '#9ca3af'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span>v1.0.0</span>
          <span style={{ margin: '0 4px' }}>•</span>
          <span 
            style={{ 
              color: theme === 'dark' ? '#3b82f6' : '#2563eb',
              cursor: 'pointer'
            }} 
            onClick={openOptionsPage}
          >
            Premium Features Available
          </span>
        </div>
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}