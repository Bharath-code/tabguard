import React, { useState, useEffect } from 'react';
import { StorageManager } from '@/shared/StorageManager';

interface TabLimitSettingsProps {
  initialTabLimit?: number;
  onTabLimitChange?: (newLimit: number) => void;
  className?: string;
  isPremium?: boolean;
}

const TabLimitSettings: React.FC<TabLimitSettingsProps> = ({ 
  initialTabLimit = 25, 
  onTabLimitChange,
  className = '',
  isPremium = false
}) => {
  const [tabLimit, setTabLimit] = useState<number>(initialTabLimit);
  const [error, setError] = useState<string | null>(null);
  const [storageManager] = useState<StorageManager>(new StorageManager());
  const [saving, setSaving] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(initialTabLimit.toString());
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  
  // Maximum tab limit based on subscription status
  const maxTabLimit = isPremium ? 1000 : 100;
  
  useEffect(() => {
    // Update local state if prop changes
    setTabLimit(initialTabLimit);
    setInputValue(initialTabLimit.toString());
  }, [initialTabLimit]);

  const validateInput = (value: string): string | null => {
    // Empty check
    if (value === '') {
      return 'Please enter a value';
    }
    
    const numValue = parseInt(value);
    
    // NaN check
    if (isNaN(numValue)) {
      return 'Please enter a valid number';
    }
    
    // Minimum value check
    if (numValue < 1) {
      return 'Tab limit must be at least 1';
    }
    
    // Maximum value check based on subscription
    if (numValue > maxTabLimit) {
      return isPremium 
        ? `Tab limit cannot exceed ${maxTabLimit}` 
        : `Tab limit cannot exceed ${maxTabLimit} (Upgrade for higher limits)`;
    }
    
    // All validations passed
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty input during typing
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Validate input
    const validationError = validateInput(newValue);
    setError(validationError);
    
    // Only update tab limit if validation passes
    if (!validationError) {
      const numValue = parseInt(newValue);
      setTabLimit(numValue);
      
      // Notify parent component if callback provided
      if (onTabLimitChange) {
        onTabLimitChange(numValue);
      }
    }
  };

  const saveTabLimit = async () => {
    try {
      // Final validation before saving
      const validationError = validateInput(inputValue);
      if (validationError) {
        setError(validationError);
        return false;
      }
      
      setSaving(true);
      setError(null);
      await storageManager.updateConfigField('tabLimit', tabLimit);
      
      // Show success message
      setShowSuccess(true);
      setTimeout(() => {
        setSaving(false);
        setShowSuccess(false);
      }, 1500);
      
      return true;
    } catch (error) {
      console.error('Failed to save tab limit:', error);
      setError('Failed to save settings. Please try again.');
      setSaving(false);
      return false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !error) {
      saveTabLimit();
    }
  };

  const handleBlur = () => {
    // Revalidate on blur to ensure valid input
    const validationError = validateInput(inputValue);
    setError(validationError);
    
    // If empty or invalid, reset to previous valid value
    if (validationError) {
      setInputValue(tabLimit.toString());
    }
  };

  return (
    <div className={`tab-limit-settings ${className}`}>
      <div className="flex flex-col space-y-2">
        <label htmlFor="tabLimit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Maximum number of tabs
        </label>
        
        <div className="flex items-center">
          <input
            id="tabLimit"
            type="number"
            min="1"
            max={maxTabLimit}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={`w-20 px-3 py-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'tabLimit-error' : undefined}
            disabled={saving}
          />
          
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            tabs
          </span>
          
          <button
            onClick={saveTabLimit}
            disabled={saving || !!error}
            className={`ml-auto px-3 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              showSuccess 
                ? 'bg-green-500 text-white cursor-default' 
                : saving
                  ? 'bg-gray-400 text-white cursor-wait'
                  : error
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700'
                    : 'bg-primary text-white hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary'
            }`}
            aria-live="polite"
          >
            {showSuccess ? '✓ Saved!' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        
        {error && (
          <p id="tabLimit-error" className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
            {error}
          </p>
        )}
        
        <div className="flex items-center mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className={`h-2.5 rounded-full ${getTabLimitColorClass()}`} 
              style={{ width: `${Math.min((tabLimit / maxTabLimit) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {isPremium 
            ? 'Recommended: 5-15 tabs for optimal performance'
            : 'Recommended: 5-15 tabs (Upgrade for unlimited tabs)'}
        </p>
      </div>
    </div>
  );
  
  // Helper function to determine color class based on tab limit
  function getTabLimitColorClass(): string {
    if (tabLimit <= 10) return 'bg-green-500';
    if (tabLimit <= 20) return 'bg-yellow-500';
    if (tabLimit <= 50) return 'bg-orange-500';
    return 'bg-red-500';
  }
};

export default TabLimitSettings;