import React, { useState } from 'react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface PremiumFeatureProps {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  upgradeMessage?: string;
  compact?: boolean;
}

/**
 * Component that conditionally renders content based on premium feature access
 * 
 * @param featureId - The ID of the feature to check access for
 * @param children - Content to render if user has access to the feature
 * @param fallback - Optional content to render if user doesn't have access
 * @param showUpgradePrompt - Whether to show an upgrade prompt if user doesn't have access
 * @param upgradeMessage - Custom message for the upgrade prompt
 * @param compact - Whether to show a compact version of the upgrade prompt
 */
const PremiumFeature: React.FC<PremiumFeatureProps> = ({
  featureId,
  children,
  fallback,
  showUpgradePrompt = true,
  upgradeMessage,
  compact = false
}) => {
  const { hasAccess, loading } = useFeatureAccess(featureId);
  const [showDetails, setShowDetails] = useState(false);

  // If still loading, show a placeholder
  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-8 w-full"></div>
    );
  }

  // If user has access, render the children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback is provided and no upgrade prompt is requested, render the fallback
  if (fallback && !showUpgradePrompt) {
    return <>{fallback}</>;
  }

  // Otherwise, show an upgrade prompt
  const defaultMessage = `This feature requires a premium subscription.`;
  const message = upgradeMessage || defaultMessage;

  // Compact version for inline use
  if (compact) {
    return (
      <div className="inline-flex items-center">
        <span className="text-gray-500 dark:text-gray-400 text-sm mr-2">{message}</span>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded"
        >
          Upgrade
        </button>
      </div>
    );
  }

  // Full version with details toggle
  return (
    <div className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div className="mb-3 sm:mb-0">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">{message}</h3>
          </div>
          
          {showDetails && (
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
              <p>Upgrade to TabGuard Pro Premium to unlock this feature and many more:</p>
              <ul className="list-disc list-inside mt-1 ml-2">
                <li>Unlimited tab limits</li>
                <li>AI-powered productivity insights</li>
                <li>Advanced tab management rules</li>
                <li>Auto-close functionality</li>
                <li>Custom themes</li>
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showDetails ? 'Hide Details' : 'Learn More'}
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
          >
            Upgrade Now
          </button>
        </div>
      </div>
      
      {/* Render fallback if provided */}
      {fallback && <div className="mt-4">{fallback}</div>}
    </div>
  );
};

export default PremiumFeature;