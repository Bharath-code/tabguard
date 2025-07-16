import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserConfig } from '@/shared/types';

const PopupApp: React.FC = () => {
  const [currentTabCount, setCurrentTabCount] = useState<number>(0);
  const [tabLimit, setTabLimit] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Get current tab count
      const tabs = await chrome.tabs.query({});
      setCurrentTabCount(tabs.length);

      // Get user configuration
      const result = await chrome.storage.sync.get('userConfig');
      const config: UserConfig = result.userConfig;
      if (config) {
        setTabLimit(config.tabLimit);
      }
    } catch (error) {
      console.error('Failed to load popup data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const isNearLimit = currentTabCount >= tabLimit * 0.8;
  const isAtLimit = currentTabCount >= tabLimit;

  return (
    <div style={{ padding: '16px' }}>
      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1a73e8' }}>
          TabGuard Pro
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
          Intelligent Tab Management
        </p>
      </header>

      <div style={{ 
        textAlign: 'center', 
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: isAtLimit ? '#fef7f0' : isNearLimit ? '#fff8e1' : '#f8f9fa',
        borderRadius: '8px',
        border: `1px solid ${isAtLimit ? '#f9ab00' : isNearLimit ? '#fbbc04' : '#e8eaed'}`
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
          {currentTabCount} / {tabLimit}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Open Tabs
        </div>
        {isAtLimit && (
          <div style={{ fontSize: '12px', color: '#d93025', marginTop: '4px' }}>
            Tab limit reached!
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={openOptionsPage}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Settings
        </button>
        
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: '#f8f9fa',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          disabled
        >
          Smart Suggestions (Coming Soon)
        </button>
      </div>

      <footer style={{ 
        marginTop: '20px', 
        textAlign: 'center', 
        fontSize: '11px', 
        color: '#999' 
      }}>
        v1.0.0 • Premium Features Available
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}