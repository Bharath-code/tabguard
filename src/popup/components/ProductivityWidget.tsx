/**
 * ProductivityWidget component for TabGuard Pro
 * 
 * Displays productivity insights and metrics in the popup UI
 * 
 * Implements requirements:
 * - 3.1: Display daily/weekly productivity metrics
 * - 3.4: Show productivity drop suggestions
 * - 3.5: Generate weekly productivity reports with actionable insights
 */

import React, { useEffect, useState, useRef } from 'react';
import { ProductivityInsights, CategoryBreakdown, WebsiteCategory } from '../../shared/types';
import PremiumFeature from '../../shared/components/PremiumFeature';

interface ProductivityWidgetProps {
  period?: 'today' | 'week' | 'custom';
  startDate?: Date;
  endDate?: Date;
  compact?: boolean;
  showGoals?: boolean;
}

interface ProductivityGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  category?: WebsiteCategory;
  deadline?: Date;
  completed: boolean;
}

const ProductivityWidget: React.FC<ProductivityWidgetProps> = ({ 
  period = 'today',
  startDate,
  endDate,
  compact = false,
  showGoals = true
}) => {
  const [insights, setInsights] = useState<ProductivityInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [periodSelector, setPeriodSelector] = useState<'today' | 'week' | 'month'>(period === 'week' ? 'week' : 'today');
  const [goals, setGoals] = useState<ProductivityGoal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState<boolean>(false);
  const [newGoal, setNewGoal] = useState<Partial<ProductivityGoal>>({
    name: '',
    target: 8,
    unit: 'score',
    category: 'work'
  });
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [trendData, setTrendData] = useState<{dates: string[], scores: number[]}>({dates: [], scores: []});

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const message: any = { action: 'getProductivityInsights', period: periodSelector };
        
        if (period === 'custom' && startDate && endDate) {
          message.startDate = startDate.toISOString();
          message.endDate = endDate.toISOString();
        }
        
        const response = await chrome.runtime.sendMessage(message);
        
        if (response.error) {
          setError(response.error);
        } else if (response.insights) {
          setInsights(response.insights);
          
          // If we have trend data in the response, update the state
          if (response.trendData) {
            setTrendData(response.trendData);
          }
        } else {
          setError('No insights data received');
        }
      } catch (err) {
        setError(`Failed to load productivity insights: ${err}`);
        console.error('Error fetching productivity insights:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInsights();
    loadGoals();
    
    // If we're showing the full view, also fetch trend data
    if (!compact) {
      fetchTrendData();
    }
  }, [period, startDate, endDate, periodSelector]);

  // Fetch trend data for visualization
  const fetchTrendData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getProductivityTrend', 
        period: periodSelector 
      });
      
      if (response && response.trendData) {
        setTrendData(response.trendData);
      }
    } catch (err) {
      console.error('Error fetching trend data:', err);
    }
  };

  // Load productivity goals from storage
  const loadGoals = async () => {
    try {
      const result = await chrome.storage.sync.get('productivityGoals');
      if (result.productivityGoals) {
        setGoals(result.productivityGoals);
      } else {
        // Initialize with default goals if none exist
        const defaultGoals: ProductivityGoal[] = [
          {
            id: 'default-1',
            name: 'Maintain productivity score',
            target: 8,
            current: 0,
            unit: 'score',
            completed: false
          },
          {
            id: 'default-2',
            name: 'Reduce social media time',
            target: 30,
            current: 0,
            unit: 'minutes',
            category: 'social',
            completed: false
          }
        ];
        
        await chrome.storage.sync.set({ productivityGoals: defaultGoals });
        setGoals(defaultGoals);
      }
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  // Save a new goal
  const saveGoal = async () => {
    if (!newGoal.name || !newGoal.target) return;
    
    try {
      const goal: ProductivityGoal = {
        id: `goal-${Date.now()}`,
        name: newGoal.name,
        target: newGoal.target,
        current: 0,
        unit: newGoal.unit || 'score',
        category: newGoal.category,
        deadline: newGoal.deadline,
        completed: false
      };
      
      const updatedGoals = [...goals, goal];
      await chrome.storage.sync.set({ productivityGoals: updatedGoals });
      setGoals(updatedGoals);
      setShowGoalForm(false);
      setNewGoal({
        name: '',
        target: 8,
        unit: 'score',
        category: 'work'
      });
    } catch (err) {
      console.error('Error saving goal:', err);
    }
  };

  // Toggle goal completion status
  const toggleGoalCompletion = async (goalId: string) => {
    try {
      const updatedGoals = goals.map(goal => {
        if (goal.id === goalId) {
          return { ...goal, completed: !goal.completed };
        }
        return goal;
      });
      
      await chrome.storage.sync.set({ productivityGoals: updatedGoals });
      setGoals(updatedGoals);
    } catch (err) {
      console.error('Error updating goal:', err);
    }
  };

  // Delete a goal
  const deleteGoal = async (goalId: string) => {
    try {
      const updatedGoals = goals.filter(goal => goal.id !== goalId);
      await chrome.storage.sync.set({ productivityGoals: updatedGoals });
      setGoals(updatedGoals);
    } catch (err) {
      console.error('Error deleting goal:', err);
    }
  };

  // Helper function to format time in a human-readable way
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper function to get color for a category
  const getCategoryColor = (category: WebsiteCategory): string => {
    switch (category) {
      case 'work':
        return '#4CAF50'; // Green
      case 'news':
        return '#2196F3'; // Blue
      case 'shopping':
        return '#FF9800'; // Orange
      case 'social':
        return '#E91E63'; // Pink
      case 'entertainment':
        return '#9C27B0'; // Purple
      case 'other':
      default:
        return '#9E9E9E'; // Gray
    }
  };

  // Helper function to calculate progress for goals
  const calculateGoalProgress = (goal: ProductivityGoal): number => {
    if (!insights) return 0;
    
    let current = 0;
    
    if (goal.unit === 'score') {
      current = insights.productivityScore;
    } else if (goal.unit === 'minutes' && goal.category && insights.timeDistribution) {
      const categoryTime = insights.timeDistribution[goal.category] || 0;
      current = Math.floor(categoryTime / (1000 * 60)); // Convert ms to minutes
    } else if (goal.unit === 'focus') {
      current = insights.focusMetrics?.focusScore || 0;
    }
    
    // Update the goal's current value
    goal.current = current;
    
    return Math.min(100, Math.round((current / goal.target) * 100));
  };

  // Render loading state
  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="animate-pulse flex flex-col space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="text-red-500 dark:text-red-400">
          <h3 className="font-medium">Error loading productivity data</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Render no data state
  if (!insights) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <p>No productivity data available yet.</p>
          <p className="text-sm mt-2">Continue browsing to generate insights.</p>
        </div>
      </div>
    );
  }

  // Render compact view
  if (compact) {
    return (
      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Productivity Score
          </h3>
          <div className="flex items-center">
            <PremiumFeature 
              featureId="ai_insights" 
              compact={true}
              fallback={
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Basic score
                </div>
              }
            >
              <div 
                className={`text-lg font-bold ${
                  insights.productivityScore >= 7 ? 'text-green-500' : 
                  insights.productivityScore >= 4 ? 'text-yellow-500' : 'text-red-500'
                }`}
              >
                {insights.productivityScore.toFixed(1)}/10
              </div>
            </PremiumFeature>
          </div>
        </div>
        
        <PremiumFeature 
          featureId="ai_insights" 
          showUpgradePrompt={false}
          fallback={
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <p>Upgrade to Premium for AI-powered productivity insights</p>
            </div>
          }
        >
          {insights.recommendations && insights.recommendations.length > 0 && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <p>{insights.recommendations[0]}</p>
            </div>
          )}
        </PremiumFeature>
      </div>
    );
  }

  // Render full view
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header with period selector */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-white">
            {periodSelector === 'today' ? 'Today\'s' : 
             periodSelector === 'week' ? 'This Week\'s' : 
             'Monthly'} Productivity
          </h3>
          <PremiumFeature 
            featureId="ai_insights" 
            showUpgradePrompt={false}
            fallback={
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Upgrade to Premium for detailed insights
              </div>
            }
          >
            <div className="mt-1 flex space-x-2">
              <button 
                onClick={() => setPeriodSelector('today')}
                className={`px-2 py-1 text-xs rounded ${
                  periodSelector === 'today' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Today
              </button>
              <button 
                onClick={() => setPeriodSelector('week')}
                className={`px-2 py-1 text-xs rounded ${
                  periodSelector === 'week' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Week
              </button>
              <button 
                onClick={() => setPeriodSelector('month')}
                className={`px-2 py-1 text-xs rounded ${
                  periodSelector === 'month' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Month
              </button>
            </div>
          </PremiumFeature>
        </div>
        <div 
          className={`text-2xl font-bold ${
            insights.productivityScore >= 7 ? 'text-green-500' : 
            insights.productivityScore >= 4 ? 'text-yellow-500' : 'text-red-500'
          }`}
        >
          {insights.productivityScore.toFixed(1)}/10
        </div>
      </div>
      
      {/* Trend visualization */}
      {trendData.dates.length > 0 && (
        <PremiumFeature 
          featureId="ai_insights"
          upgradeMessage="Productivity trends require a premium subscription"
          fallback={
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Upgrade to Premium to view your productivity trends over time
                </p>
              </div>
            </div>
          }
        >
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Productivity Trend
            </h4>
            <div className="h-32 w-full bg-gray-50 dark:bg-gray-900 rounded p-2">
              <div className="relative h-full w-full">
                {/* Simple trend visualization */}
                <div className="flex items-end justify-between h-full w-full">
                  {trendData.scores.map((score, index) => {
                    const height = `${Math.max(5, score * 10)}%`;
                    const color = score >= 7 ? '#4CAF50' : score >= 4 ? '#FF9800' : '#F44336';
                    
                    return (
                      <div key={index} className="flex flex-col items-center flex-1">
                        <div 
                          className="w-full mx-0.5 rounded-t" 
                          style={{ 
                            height, 
                            backgroundColor: color,
                            maxWidth: '20px'
                          }}
                        ></div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" style={{fontSize: '0.65rem'}}>
                          {new Date(trendData.dates[index]).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Horizontal lines for reference */}
                <div className="absolute top-1/4 left-0 right-0 border-t border-dashed border-gray-300 dark:border-gray-700"></div>
                <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-300 dark:border-gray-700"></div>
                <div className="absolute top-3/4 left-0 right-0 border-t border-dashed border-gray-300 dark:border-gray-700"></div>
              </div>
            </div>
          </div>
        </PremiumFeature>
      )}
      
      {/* Category breakdown */}
      {insights.categoryBreakdown && insights.categoryBreakdown.length > 0 && (
        <PremiumFeature 
          featureId="ai_insights"
          upgradeMessage="Detailed time distribution requires a premium subscription"
          fallback={
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Upgrade to Premium to see how you spend your browsing time
                </p>
              </div>
            </div>
          }
        >
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Distribution
            </h4>
            <div className="space-y-2">
              {insights.categoryBreakdown.map((category, index) => (
                <div key={index} className="flex flex-col">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{category.category}</span>
                    <span>{formatTime(category.timeSpent)} ({Math.round(category.percentage)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{
                        width: `${category.percentage}%`,
                        backgroundColor: getCategoryColor(category.category)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PremiumFeature>
      )}
      
      {/* Focus metrics */}
      {insights.focusMetrics && (
        <PremiumFeature 
          featureId="ai_insights"
          upgradeMessage="Focus metrics require a premium subscription"
          fallback={
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Upgrade to Premium to track your focus metrics and improve productivity
                </p>
              </div>
            </div>
          }
        >
          <div className="mb-6 grid grid-cols-2 gap-2">
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Focus Score</div>
              <div className="font-medium">{insights.focusMetrics.focusScore.toFixed(1)}/10</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Longest Focus</div>
              <div className="font-medium">{insights.focusMetrics.longestFocusSession} min</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Distractions</div>
              <div className="font-medium">{insights.focusMetrics.distractionCount}</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg Focus Time</div>
              <div className="font-medium">{insights.focusMetrics.averageFocusTime} min</div>
            </div>
          </div>
        </PremiumFeature>
      )}
      
      {/* Productivity Goals */}
      {showGoals && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Productivity Goals
            </h4>
            <button 
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showGoalForm ? 'Cancel' : '+ Add Goal'}
            </button>
          </div>
          
          {/* Goal form */}
          {showGoalForm && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Goal name"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                  className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex space-x-2 mb-2">
                <input
                  type="number"
                  placeholder="Target"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({...newGoal, target: parseInt(e.target.value)})}
                  className="w-1/3 p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <select
                  value={newGoal.unit}
                  onChange={(e) => setNewGoal({...newGoal, unit: e.target.value as any})}
                  className="w-2/3 p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="score">Productivity Score</option>
                  <option value="focus">Focus Score</option>
                  <option value="minutes">Minutes (Category)</option>
                </select>
              </div>
              
              {newGoal.unit === 'minutes' && (
                <div className="mb-2">
                  <select
                    value={newGoal.category}
                    onChange={(e) => setNewGoal({...newGoal, category: e.target.value as WebsiteCategory})}
                    className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="work">Work</option>
                    <option value="social">Social</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="news">News</option>
                    <option value="shopping">Shopping</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              
              <button
                onClick={saveGoal}
                disabled={!newGoal.name || !newGoal.target}
                className={`w-full p-2 text-sm text-white rounded ${
                  !newGoal.name || !newGoal.target
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                Save Goal
              </button>
            </div>
          )}
          
          {/* Goals list */}
          {goals.length > 0 ? (
            <div className="space-y-3">
              {goals.map(goal => {
                const progress = calculateGoalProgress(goal);
                return (
                  <div key={goal.id} className="flex flex-col">
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={goal.completed}
                          onChange={() => toggleGoalCompletion(goal.id)}
                          className="mr-2"
                        />
                        <span className={goal.completed ? 'line-through text-gray-500' : ''}>
                          {goal.name}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">
                          {goal.current}/{goal.target} {goal.unit === 'minutes' ? 'min' : ''}
                        </span>
                        <button 
                          onClick={() => deleteGoal(goal.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No goals set. Add a goal to track your productivity.
            </div>
          )}
        </div>
      )}
      
      {/* Recommendations */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Personalized Recommendations
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {insights.recommendations.map((recommendation, index) => (
              <li key={index} className="flex">
                <span className="mr-2">•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
          
          {/* Display actionable recommendations if available */}
          {insights.fullRecommendations && insights.fullRecommendations.filter(rec => rec.actionable).length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Actions You Can Take
              </h5>
              <div className="flex flex-wrap gap-2">
                {insights.fullRecommendations
                  .filter(rec => rec.actionable)
                  .slice(0, 3) // Show max 3 actions
                  .map((rec, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        chrome.runtime.sendMessage({
                          action: 'executeRecommendation',
                          recommendationType: rec.type,
                          recommendationAction: rec.action
                        });
                      }}
                      className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      {rec.title}
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Display tab limit recommendation if available */}
      {insights.tabLimitRecommendation && 
       insights.tabLimitRecommendation.recommendedLimit !== insights.tabLimitRecommendation.currentLimit && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Optimal Tab Limit: {insights.tabLimitRecommendation.recommendedLimit}
              </h5>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {insights.tabLimitRecommendation.reasoning}
              </p>
            </div>
            <button
              onClick={() => {
                chrome.runtime.sendMessage({
                  action: 'updateConfig',
                  config: { tabLimit: insights.tabLimitRecommendation.recommendedLimit }
                });
              }}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
      
      {/* Export report button */}
      <div className="mt-4 text-center">
        <button 
          onClick={() => chrome.runtime.sendMessage({ action: 'exportProductivityReport', period: periodSelector })}
          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Export {periodSelector === 'today' ? 'Daily' : periodSelector === 'week' ? 'Weekly' : 'Monthly'} Report
        </button>
      </div>
    </div>
  );
};

export default ProductivityWidget;