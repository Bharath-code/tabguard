import React, { useState, useEffect } from 'react';
import { WebsiteCategory } from '../../shared/types';

interface TabSuggestionItem {
  tabId: number;
  title: string;
  url: string;
  lastAccessed: Date;
  memoryUsage: number;
  productivityScore: number;
  closureScore: number;
  formattedLastAccessed: string;
  formattedMemoryUsage: string;
  category: WebsiteCategory;
  isPinned: boolean;
  selected?: boolean;
}

interface TabSuggestionsProps {
  onClose: (tabIds: number[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const TabSuggestions: React.FC<TabSuggestionsProps> = ({ onClose, onCancel, isOpen }) => {
  const [suggestions, setSuggestions] = useState<TabSuggestionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<Set<number>>(new Set());

  // Load suggestions when component mounts or isOpen changes
  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get suggestions from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getSuggestedTabs',
        maxSuggestions: 5,
        minInactivityMinutes: 30,
        includePinnedTabs: false,
        prioritizeMemoryUsage: true,
        prioritizeLowProductivity: true,
        excludeWorkTabs: true
      });

      if (response && Array.isArray(response.suggestions)) {
        // Add selected property to each suggestion
        const suggestionsWithSelection = response.suggestions.map((suggestion: TabSuggestionItem) => ({
          ...suggestion,
          selected: true
        }));

        setSuggestions(suggestionsWithSelection);

        // Initialize all tabs as selected
        const tabIds = new Set<number>(suggestionsWithSelection.map((s: { tabId: any; }) => s.tabId));
        setSelectedTabs(tabIds);
      } else {
        setSuggestions([]);
        setSelectedTabs(new Set());
      }
    } catch (error) {
      console.error('Failed to load tab suggestions:', error);
      setError('Failed to load suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTab = (tabId: number) => {
    const newSelectedTabs = new Set(selectedTabs);

    if (newSelectedTabs.has(tabId)) {
      newSelectedTabs.delete(tabId);
    } else {
      newSelectedTabs.add(tabId);
    }

    setSelectedTabs(newSelectedTabs);

    // Update suggestions to reflect selection state
    setSuggestions(suggestions.map(suggestion => ({
      ...suggestion,
      selected: newSelectedTabs.has(suggestion.tabId)
    })));
  };

  const handleSelectAll = () => {
    const allTabIds = new Set(suggestions.map(s => s.tabId));
    setSelectedTabs(allTabIds);

    // Update suggestions to reflect selection state
    setSuggestions(suggestions.map(suggestion => ({
      ...suggestion,
      selected: true
    })));
  };

  const handleSelectNone = () => {
    setSelectedTabs(new Set());

    // Update suggestions to reflect selection state
    setSuggestions(suggestions.map(suggestion => ({
      ...suggestion,
      selected: false
    })));
  };

  const handleCloseTabs = () => {
    if (selectedTabs.size === 0) return;

    const tabIdsToClose = Array.from(selectedTabs);
    onClose(tabIdsToClose);
  };

  // Get category icon based on website category
  const getCategoryIcon = (category: WebsiteCategory) => {
    switch (category) {
      case 'work':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'social':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'entertainment':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'news':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        );
      case 'shopping':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Get category color based on website category
  const getCategoryColor = (category: WebsiteCategory) => {
    switch (category) {
      case 'work':
        return 'bg-blue-100 text-blue-800';
      case 'social':
        return 'bg-purple-100 text-purple-800';
      case 'entertainment':
        return 'bg-red-100 text-red-800';
      case 'news':
        return 'bg-green-100 text-green-800';
      case 'shopping':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Suggested Tabs to Close
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select tabs you want to close based on our intelligent suggestions
          </p>
        </div>

        <div className="overflow-y-auto flex-grow p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              {error}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 p-4">
              No suggestions available. All your tabs appear to be active.
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.tabId}
                  className={`border rounded-lg p-3 flex items-start ${suggestion.selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20'
                      : 'border-gray-200 dark:border-gray-700'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={suggestion.selected}
                    onChange={() => handleToggleTab(suggestion.tabId)}
                    className="h-5 w-5 text-blue-600 rounded mr-3 mt-0.5"
                  />

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center mb-1">
                      <div className="flex-shrink-0">
                        {suggestion.isPinned && (
                          <span className="inline-flex items-center mr-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            Pinned
                          </span>
                        )}
                      </div>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(suggestion.category)}`}>
                        {getCategoryIcon(suggestion.category)}
                        <span className="ml-1 capitalize">{suggestion.category}</span>
                      </span>
                    </div>

                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {suggestion.title || 'Untitled Tab'}
                    </h3>

                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {suggestion.url}
                    </p>

                    <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400 space-x-3">
                      <div className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {suggestion.formattedLastAccessed}
                      </div>

                      <div className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {suggestion.formattedMemoryUsage}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between">
          <div className="flex space-x-2 mb-3 sm:mb-0">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              disabled={loading || suggestions.length === 0}
            >
              Select All
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={handleSelectNone}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              disabled={loading || suggestions.length === 0}
            >
              Select None
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseTabs}
              disabled={selectedTabs.size === 0 || loading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${selectedTabs.size === 0 || loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              Close {selectedTabs.size} {selectedTabs.size === 1 ? 'Tab' : 'Tabs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabSuggestions;