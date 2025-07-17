import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserConfig } from '@/shared/types';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Options page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ color: '#d93025', marginBottom: '16px' }}>
            Something went wrong
          </h2>
          <p style={{ marginBottom: '16px' }}>
            The settings page encountered an error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1a73e8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const OptionsApp: React.FC = () => {
  const [config, setConfig] = useState<UserConfig>({
    tabLimit: 10,
    autoCloseEnabled: false,
    autoCloseDelay: 30,
    theme: 'auto',
    notificationsEnabled: true,
    rules: [],
    profiles: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setError(null);
      const result = await chrome.storage.sync.get('userConfig');
      if (result.userConfig) {
        setConfig(result.userConfig);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setError('Failed to load settings. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      await chrome.storage.sync.set({ userConfig: config });
      // Show success message briefly
      setTimeout(() => setSaving(false), 1000);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<UserConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#d93025', marginBottom: '16px' }}>
          {error}
        </div>
        <button
          onClick={loadConfiguration}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <header style={{ marginBottom: '32px', borderBottom: '1px solid #e8eaed', paddingBottom: '16px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#1a73e8' }}>
          TabGuard Pro Settings
        </h1>
        <p style={{ margin: 0, color: '#666' }}>
          Configure your tab management preferences
        </p>
      </header>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Tab Limit Settings */}
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Tab Limit</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label htmlFor="tabLimit" style={{ minWidth: '120px' }}>
              Maximum tabs:
            </label>
            <input
              id="tabLimit"
              type="number"
              min="1"
              max="100"
              value={config.tabLimit}
              onChange={(e) => updateConfig({ tabLimit: parseInt(e.target.value) || 10 })}
              style={{
                padding: '8px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                width: '80px'
              }}
            />
            <span style={{ color: '#666', fontSize: '14px' }}>
              (Recommended: 5-15 tabs)
            </span>
          </div>
        </section>

        {/* Auto-close Settings */}
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Auto-close Inactive Tabs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={config.autoCloseEnabled}
                onChange={(e) => updateConfig({ autoCloseEnabled: e.target.checked })}
              />
              Enable automatic closing of inactive tabs
            </label>

            {config.autoCloseEnabled && (
              <div style={{ marginLeft: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label htmlFor="autoCloseDelay">Close tabs inactive for:</label>
                <select
                  id="autoCloseDelay"
                  value={config.autoCloseDelay}
                  onChange={(e) => updateConfig({ autoCloseDelay: parseInt(e.target.value) })}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #dadce0',
                    borderRadius: '4px'
                  }}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Theme Settings */}
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Appearance</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label htmlFor="theme" style={{ minWidth: '120px' }}>
              Theme:
            </label>
            <select
              id="theme"
              value={config.theme}
              onChange={(e) => updateConfig({ theme: e.target.value as 'light' | 'dark' | 'auto' })}
              style={{
                padding: '8px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px'
              }}
            >
              <option value="auto">Auto (System)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Notifications</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.notificationsEnabled}
              onChange={(e) => updateConfig({ notificationsEnabled: e.target.checked })}
            />
            Show notifications when tab limit is reached
          </label>
        </section>

        {/* Data Management Section */}
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Data Management</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Backup and Restore */}
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Backup & Restore</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      // Call the background script to create a backup
                      await chrome.runtime.sendMessage({ action: 'createBackup' });
                      alert('Backup created successfully!');
                    } catch (error) {
                      console.error('Failed to create backup:', error);
                      alert('Failed to create backup. Please try again.');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Create Backup
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      // Call the background script to restore from backup
                      const result = await chrome.runtime.sendMessage({ action: 'restoreFromBackup' });
                      if (result) {
                        alert('Configuration restored successfully!');
                        // Reload configuration
                        loadConfiguration();
                      } else {
                        alert('No backup found to restore.');
                      }
                    } catch (error) {
                      console.error('Failed to restore backup:', error);
                      alert('Failed to restore backup. Please try again.');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Restore from Backup
                </button>
              </div>
            </div>
            
            {/* Export and Import */}
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Export & Import</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      // Call the background script to export configuration
                      const jsonData = await chrome.runtime.sendMessage({ action: 'exportConfig' });
                      
                      // Create a download link
                      const blob = new Blob([jsonData], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `tabguard-config-${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Failed to export configuration:', error);
                      alert('Failed to export configuration. Please try again.');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Export Configuration
                </button>
                
                <label
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-block'
                  }}
                >
                  Import Configuration
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const jsonData = event.target?.result as string;
                          
                          // Call the background script to import configuration
                          const result = await chrome.runtime.sendMessage({ 
                            action: 'importConfig', 
                            data: jsonData 
                          });
                          
                          if (result.success) {
                            alert('Configuration imported successfully!');
                            // Reload configuration
                            loadConfiguration();
                          } else {
                            alert(`Import failed: ${result.messages.join('\n')}`);
                          }
                        };
                        reader.readAsText(file);
                      } catch (error) {
                        console.error('Failed to import configuration:', error);
                        alert('Failed to import configuration. Please try again.');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            
            {/* Reset and Storage Stats */}
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Other Options</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to reset all settings to default values? This cannot be undone.')) {
                      try {
                        // Call the background script to reset configuration
                        await chrome.runtime.sendMessage({ action: 'resetToDefaults' });
                        alert('Settings reset to defaults successfully!');
                        // Reload configuration
                        loadConfiguration();
                      } catch (error) {
                        console.error('Failed to reset settings:', error);
                        alert('Failed to reset settings. Please try again.');
                      }
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#d93025',
                    border: '1px solid #d93025',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Reset to Defaults
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      // Call the background script to get storage stats
                      const stats = await chrome.runtime.sendMessage({ action: 'getStorageStats' });
                      const usedPercent = Math.round((stats.bytesInUse / stats.quota) * 100);
                      alert(`Storage Usage: ${stats.bytesInUse} bytes (${usedPercent}% of quota)`);
                    } catch (error) {
                      console.error('Failed to get storage stats:', error);
                      alert('Failed to get storage statistics. Please try again.');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  View Storage Usage
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Features Placeholder */}
        <section style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e8eaed'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Premium Features</h2>
          <p style={{ margin: '0 0 12px 0', color: '#666' }}>
            Unlock advanced tab management with AI-powered insights, custom rules, and team features.
          </p>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#1a73e8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            disabled
          >
            Upgrade to Premium (Coming Soon)
          </button>
        </section>
      </div>

      {/* Save Button */}
      <div style={{
        marginTop: '32px',
        paddingTop: '16px',
        borderTop: '1px solid #e8eaed',
        textAlign: 'right'
      }}>
        <button
          onClick={saveConfiguration}
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#34a853' : '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'default' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {saving ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <OptionsApp />
    </ErrorBoundary>
  );
} else {
  console.error('Failed to find root container for options page');
}