import { useState, useEffect } from 'react';

/**
 * Hook to check if a user has access to a specific premium feature
 * 
 * @param featureId - The ID of the feature to check access for
 * @param fallbackValue - Optional fallback value if the check fails
 * @returns Object containing access status and loading state
 */
export function useFeatureAccess(featureId: string, fallbackValue: boolean = false) {
  const [hasAccess, setHasAccess] = useState<boolean>(fallbackValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await chrome.runtime.sendMessage({ 
          action: 'hasFeatureAccess', 
          featureId 
        });
        
        if (response.error) {
          throw new Error(response.error);
        }
        
        setHasAccess(response.hasAccess);
      } catch (err) {
        console.error(`Error checking access for feature ${featureId}:`, err);
        setError(`Failed to check feature access: ${err}`);
        setHasAccess(fallbackValue);
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [featureId, fallbackValue]);

  return { hasAccess, loading, error };
}