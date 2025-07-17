import React, { useState, useEffect } from 'react';
import { StorageManager } from '@/shared/StorageManager';

interface ThemeSelectorProps {
  initialTheme?: 'light' | 'dark' | 'auto';
  onThemeChange?: (theme: 'light' | 'dark' | 'auto') => void;
  className?: string;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  initialTheme = 'auto',
  onThemeChange,
  className = ''
}) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(initialTheme);
  const [storageManager] = useState<StorageManager>(new StorageManager());
  const [saving, setSaving] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    // Update local state if prop changes
    setTheme(initialTheme);
    
    // Set up system theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Initial check
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    
    // Add listener for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
      if (theme === 'auto') {
        applyTheme('auto');
      }
    };
    
    // Modern browsers
    try {
      mediaQuery.addEventListener('change', handleChange);
    } catch (e) {
      // Fallback for older browsers
      try {
        mediaQuery.addListener(handleChange);
      } catch (e2) {
        console.error('Could not add media query listener', e2);
      }
    }
    
    // Apply theme on component mount
    applyTheme(initialTheme);
    
    // Cleanup
    return () => {
      try {
        mediaQuery.removeEventListener('change', handleChange);
      } catch (e) {
        try {
          mediaQuery.removeListener(handleChange);
        } catch (e2) {
          console.error('Could not remove media query listener', e2);
        }
      }
    };
  }, [initialTheme]);

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTheme = e.target.value as 'light' | 'dark' | 'auto';
    setTheme(newTheme);
    
    // Apply theme immediately for better UX
    applyTheme(newTheme);
    
    // Notify parent component if callback provided
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const saveTheme = async () => {
    try {
      setSaving(true);
      setError(null);
      await storageManager.updateConfigField('theme', theme);
      
      // Apply theme immediately
      applyTheme(theme);
      
      // Show success message
      setShowSuccess(true);
      setTimeout(() => {
        setSaving(false);
        setShowSuccess(false);
      }, 1500);
      
      return true;
    } catch (error) {
      console.error('Failed to save theme setting:', error);
      setError('Failed to save theme. Please try again.');
      setSaving(false);
      return false;
    }
  };

  const applyTheme = (selectedTheme: 'light' | 'dark' | 'auto') => {
    if (selectedTheme === 'dark' || 
        (selectedTheme === 'auto' && systemTheme === 'dark')) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Get the actual theme being applied (for display purposes)
  const getEffectiveTheme = (): 'light' | 'dark' => {
    return theme === 'auto' ? systemTheme : theme;
  };

  // Get theme icon based on current theme
  const getThemeIcon = (themeType: 'light' | 'dark' | 'auto'): string => {
    switch (themeType) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'auto':
        return systemTheme === 'dark' ? '🌙' : '☀️';
    }
  };

  return (
    <div className={`theme-selector ${className}`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Theme
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Currently: {getEffectiveTheme() === 'dark' ? 'Dark' : 'Light'} {getThemeIcon(theme)}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-md cursor-pointer border ${
              theme === 'light' 
                ? 'border-primary bg-blue-50 dark:bg-blue-900' 
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            }`}
            onClick={() => {
              setTheme('light');
              applyTheme('light');
              if (onThemeChange) onThemeChange('light');
            }}
          >
            <div className="text-xl mb-1">☀️</div>
            <div className="flex items-center">
              <input
                id="theme-light"
                type="radio"
                value="light"
                checked={theme === 'light'}
                onChange={handleThemeChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="theme-light" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Light
              </label>
            </div>
          </div>
          
          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-md cursor-pointer border ${
              theme === 'dark' 
                ? 'border-primary bg-blue-50 dark:bg-blue-900' 
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            }`}
            onClick={() => {
              setTheme('dark');
              applyTheme('dark');
              if (onThemeChange) onThemeChange('dark');
            }}
          >
            <div className="text-xl mb-1">🌙</div>
            <div className="flex items-center">
              <input
                id="theme-dark"
                type="radio"
                value="dark"
                checked={theme === 'dark'}
                onChange={handleThemeChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="theme-dark" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Dark
              </label>
            </div>
          </div>
          
          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-md cursor-pointer border ${
              theme === 'auto' 
                ? 'border-primary bg-blue-50 dark:bg-blue-900' 
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            }`}
            onClick={() => {
              setTheme('auto');
              applyTheme('auto');
              if (onThemeChange) onThemeChange('auto');
            }}
          >
            <div className="text-xl mb-1">🔄</div>
            <div className="flex items-center">
              <input
                id="theme-auto"
                type="radio"
                value="auto"
                checked={theme === 'auto'}
                onChange={handleThemeChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="theme-auto" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Auto
              </label>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={saveTheme}
            disabled={saving}
            className={`px-3 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              showSuccess 
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
        
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
            {error}
          </p>
        )}
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Auto will follow your system's light/dark mode preference
        </p>
      </div>
    </div>
  );
};

export default ThemeSelector;