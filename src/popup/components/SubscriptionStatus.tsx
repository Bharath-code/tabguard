import React, { useState, useEffect } from 'react';
import { SubscriptionPlan } from '../../shared/types';

interface SubscriptionState {
  plan: string;
  expiresAt: string | null;
  features: Record<string, boolean>;
  tabLimit: number;
  subscriptionId?: string;
  customerId?: string;
}

const SubscriptionStatus: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        
        // Get current plan
        const planResponse = await chrome.runtime.sendMessage({ action: 'getCurrentPlan' });
        if (planResponse.error) {
          throw new Error(planResponse.error);
        }
        
        // Get subscription state
        const stateResponse = await chrome.runtime.sendMessage({ action: 'getSubscriptionState' });
        if (stateResponse.error) {
          throw new Error(stateResponse.error);
        }
        
        setCurrentPlan(planResponse.plan);
        setSubscriptionState(stateResponse.state);
        setError(null);
      } catch (err) {
        setError(`Failed to load subscription data`);
        console.error('Error loading subscription data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading subscription status...</div>;
  }

  if (error || !currentPlan) {
    return null;
  }

  // Format expiry date if available
  const formatExpiryDate = () => {
    if (!subscriptionState?.expiresAt) return null;
    
    const expiryDate = new Date(subscriptionState.expiresAt);
    return expiryDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // For free plan, show upgrade button
  if (currentPlan.id === 'free') {
    return (
      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-3">
        <div className="text-sm">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3.586l2.707 2.707a1 1 0 11-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L9 10.586V7z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Free Plan</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Limited to {currentPlan.tabLimit} tabs
          </div>
        </div>
        <button 
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center"
        >
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Upgrade
        </button>
      </div>
    );
  }

  // For premium plans, show current status with details toggle
  return (
    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">
            <span className="font-medium">{currentPlan.name} Plan</span>
          </div>
        </div>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-green-700 dark:text-green-400 hover:underline"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-2 pl-6 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Tab Limit:</span>
            <span className="font-medium">{currentPlan.tabLimit} tabs</span>
          </div>
          {formatExpiryDate() && (
            <div className="flex justify-between">
              <span>Renews on:</span>
              <span className="font-medium">{formatExpiryDate()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>AI Insights:</span>
            <span className="font-medium">{currentPlan.aiInsights ? 'Included' : 'Not included'}</span>
          </div>
          <div className="flex justify-between">
            <span>Team Features:</span>
            <span className="font-medium">{currentPlan.teamFeatures ? 'Included' : 'Not included'}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="text-green-700 dark:text-green-400 hover:underline"
            >
              Manage Subscription
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus;