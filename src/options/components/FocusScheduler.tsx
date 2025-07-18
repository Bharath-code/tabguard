import React, { useState, useEffect } from 'react';
import { 
  ScheduledFocusSession, 
  TimeBasedRuleSchedule, 
  FocusModeSettings 
} from '../../background/FocusModeManager';

interface FocusSchedulerProps {
  onClose?: () => void;
}

const FocusScheduler: React.FC<FocusSchedulerProps> = ({ onClose }) => {
  // State for focus sessions
  const [focusSessions, setFocusSessions] = useState<ScheduledFocusSession[]>([]);
  const [timeRules, setTimeRules] = useState<TimeBasedRuleSchedule[]>([]);
  const [availableRules, setAvailableRules] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for editing
  const [editingSession, setEditingSession] = useState<ScheduledFocusSession | null>(null);
  const [editingRule, setEditingRule] = useState<TimeBasedRuleSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'rules'>('sessions');
  
  // Days of week for selection
  const daysOfWeek = [
    { id: 0, name: 'Sunday' },
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
    { id: 6, name: 'Saturday' }
  ];

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Load all necessary data
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load scheduled focus sessions
      const sessionsResponse = await chrome.runtime.sendMessage({ action: 'getScheduledSessions' });
      if (sessionsResponse.sessions) {
        setFocusSessions(sessionsResponse.sessions);
      }
      
      // Load time-based rules
      const rulesResponse = await chrome.runtime.sendMessage({ action: 'getTimeBasedRules' });
      if (rulesResponse.rules) {
        setTimeRules(rulesResponse.rules);
      }
      
      // Load available rules for time-based rules
      const allRulesResponse = await chrome.runtime.sendMessage({ action: 'getRules' });
      if (allRulesResponse.rules) {
        setAvailableRules(allRulesResponse.rules.map((rule: any) => ({ 
          id: rule.id, 
          name: rule.name 
        })));
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading scheduler data:', err);
      setError('Failed to load scheduler data');
      setLoading(false);
    }
  };

  // Create a new focus session
  const createNewSession = () => {
    // Get default focus mode settings
    chrome.runtime.sendMessage({ action: 'getFocusModeSettings' }, (response) => {
      if (response.settings) {
        const newSession: Omit<ScheduledFocusSession, 'id'> = {
          name: 'New Focus Session',
          startTime: '09:00',
          endTime: '10:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
          enabled: true,
          settings: response.settings
        };
        
        setEditingSession(newSession as ScheduledFocusSession);
      }
    });
  };

  // Create a new time-based rule
  const createNewTimeRule = () => {
    const newRule: Omit<TimeBasedRuleSchedule, 'id'> = {
      name: 'New Time Rule',
      ruleIds: [],
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      enabled: true
    };
    
    setEditingRule(newRule as TimeBasedRuleSchedule);
  };

  // Save focus session
  const saveSession = async () => {
    try {
      if (!editingSession) return;
      
      if (editingSession.id) {
        // Update existing session
        const response = await chrome.runtime.sendMessage({
          action: 'updateScheduledSession',
          id: editingSession.id,
          updates: editingSession
        });
        
        if (response.success) {
          setFocusSessions(prev => 
            prev.map(session => 
              session.id === editingSession.id ? editingSession : session
            )
          );
          setEditingSession(null);
        } else {
          setError('Failed to update focus session');
        }
      } else {
        // Create new session
        const response = await chrome.runtime.sendMessage({
          action: 'addScheduledSession',
          session: editingSession
        });
        
        if (response.success && response.id) {
          const newSession = { ...editingSession, id: response.id };
          setFocusSessions(prev => [...prev, newSession]);
          setEditingSession(null);
        } else {
          setError('Failed to create focus session');
        }
      }
    } catch (err) {
      console.error('Error saving focus session:', err);
      setError('Failed to save focus session');
    }
  };

  // Save time-based rule
  const saveTimeRule = async () => {
    try {
      if (!editingRule) return;
      
      if (editingRule.id) {
        // Update existing rule
        const response = await chrome.runtime.sendMessage({
          action: 'updateTimeBasedRule',
          id: editingRule.id,
          updates: editingRule
        });
        
        if (response.success) {
          setTimeRules(prev => 
            prev.map(rule => 
              rule.id === editingRule.id ? editingRule : rule
            )
          );
          setEditingRule(null);
        } else {
          setError('Failed to update time rule');
        }
      } else {
        // Create new rule
        const response = await chrome.runtime.sendMessage({
          action: 'addTimeBasedRule',
          rule: editingRule
        });
        
        if (response.success && response.id) {
          const newRule = { ...editingRule, id: response.id };
          setTimeRules(prev => [...prev, newRule]);
          setEditingRule(null);
        } else {
          setError('Failed to create time rule');
        }
      }
    } catch (err) {
      console.error('Error saving time rule:', err);
      setError('Failed to save time rule');
    }
  };

  // Delete focus session
  const deleteSession = async (id: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteScheduledSession',
        id
      });
      
      if (response.success) {
        setFocusSessions(prev => prev.filter(session => session.id !== id));
      } else {
        setError('Failed to delete focus session');
      }
    } catch (err) {
      console.error('Error deleting focus session:', err);
      setError('Failed to delete focus session');
    }
  };

  // Delete time-based rule
  const deleteTimeRule = async (id: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteTimeBasedRule',
        id
      });
      
      if (response.success) {
        setTimeRules(prev => prev.filter(rule => rule.id !== id));
      } else {
        setError('Failed to delete time rule');
      }
    } catch (err) {
      console.error('Error deleting time rule:', err);
      setError('Failed to delete time rule');
    }
  };

  // Toggle session enabled state
  const toggleSessionEnabled = async (session: ScheduledFocusSession) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateScheduledSession',
        id: session.id,
        updates: { enabled: !session.enabled }
      });
      
      if (response.success) {
        setFocusSessions(prev => 
          prev.map(s => 
            s.id === session.id ? { ...s, enabled: !s.enabled } : s
          )
        );
      } else {
        setError('Failed to update session');
      }
    } catch (err) {
      console.error('Error toggling session:', err);
      setError('Failed to toggle session');
    }
  };

  // Toggle rule enabled state
  const toggleRuleEnabled = async (rule: TimeBasedRuleSchedule) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateTimeBasedRule',
        id: rule.id,
        updates: { enabled: !rule.enabled }
      });
      
      if (response.success) {
        setTimeRules(prev => 
          prev.map(r => 
            r.id === rule.id ? { ...r, enabled: !r.enabled } : r
          )
        );
      } else {
        setError('Failed to update rule');
      }
    } catch (err) {
      console.error('Error toggling rule:', err);
      setError('Failed to toggle rule');
    }
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      return new Date(0, 0, 0, hours, minutes).toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (err) {
      return timeString;
    }
  };

  // Format days of week for display
  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Weekdays';
    if (days.length === 2 && [0, 6].every(d => days.includes(d))) return 'Weekends';
    
    return days
      .map(d => daysOfWeek.find(day => day.id === d)?.name.substring(0, 3))
      .join(', ');
  };

  // Update editing session field
  const updateSessionField = (field: keyof ScheduledFocusSession, value: any) => {
    if (!editingSession) return;
    setEditingSession({ ...editingSession, [field]: value });
  };

  // Update editing rule field
  const updateRuleField = (field: keyof TimeBasedRuleSchedule, value: any) => {
    if (!editingRule) return;
    setEditingRule({ ...editingRule, [field]: value });
  };

  // Toggle day selection for session
  const toggleSessionDay = (dayId: number) => {
    if (!editingSession) return;
    
    const currentDays = editingSession.daysOfWeek || [];
    const newDays = currentDays.includes(dayId)
      ? currentDays.filter(d => d !== dayId)
      : [...currentDays, dayId];
    
    updateSessionField('daysOfWeek', newDays);
  };

  // Toggle day selection for rule
  const toggleRuleDay = (dayId: number) => {
    if (!editingRule) return;
    
    const currentDays = editingRule.daysOfWeek || [];
    const newDays = currentDays.includes(dayId)
      ? currentDays.filter(d => d !== dayId)
      : [...currentDays, dayId];
    
    updateRuleField('daysOfWeek', newDays);
  };

  // Toggle rule selection
  const toggleRuleSelection = (ruleId: string) => {
    if (!editingRule) return;
    
    const currentRules = editingRule.ruleIds || [];
    const newRules = currentRules.includes(ruleId)
      ? currentRules.filter(id => id !== ruleId)
      : [...currentRules, ruleId];
    
    updateRuleField('ruleIds', newRules);
  };

  // Update focus mode settings
  const updateFocusModeSettings = (field: keyof FocusModeSettings, value: any) => {
    if (!editingSession || !editingSession.settings) return;
    
    const updatedSettings = {
      ...editingSession.settings,
      [field]: value
    };
    
    updateSessionField('settings', updatedSettings);
  };

  if (loading) {
    return <div className="p-4 text-center">Loading scheduler data...</div>;
  }

  // Render session editor
  const renderSessionEditor = () => {
    if (!editingSession) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {editingSession.id ? 'Edit Focus Session' : 'New Focus Session'}
            </h3>
            <button 
              onClick={() => setEditingSession(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Session Name
              </label>
              <input
                type="text"
                value={editingSession.name}
                onChange={(e) => updateSessionField('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={editingSession.startTime}
                  onChange={(e) => updateSessionField('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={editingSession.endTime}
                  onChange={(e) => updateSessionField('endTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Days of Week
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <button
                    key={day.id}
                    onClick={() => toggleSessionDay(day.id)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      editingSession.daysOfWeek?.includes(day.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {day.name.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tab Limit During Focus
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={editingSession.settings?.tabLimit || 5}
                onChange={(e) => updateFocusModeSettings('tabLimit', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="block-distractions"
                type="checkbox"
                checked={editingSession.settings?.blockDistractions || false}
                onChange={(e) => updateFocusModeSettings('blockDistractions', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="block-distractions" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Block distracting sites during focus
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="session-enabled"
                type="checkbox"
                checked={editingSession.enabled}
                onChange={(e) => updateSessionField('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="session-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Enable this scheduled session
              </label>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditingSession(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveSession}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render rule editor
  const renderRuleEditor = () => {
    if (!editingRule) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {editingRule.id ? 'Edit Time-Based Rule' : 'New Time-Based Rule'}
            </h3>
            <button 
              onClick={() => setEditingRule(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => updateRuleField('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={editingRule.startTime}
                  onChange={(e) => updateRuleField('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={editingRule.endTime}
                  onChange={(e) => updateRuleField('endTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Days of Week
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <button
                    key={day.id}
                    onClick={() => toggleRuleDay(day.id)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      editingRule.daysOfWeek?.includes(day.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {day.name.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rules to Activate
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-2 max-h-40 overflow-y-auto">
                {availableRules.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                    No rules available. Create rules in the Rule Manager first.
                  </p>
                ) : (
                  availableRules.map(rule => (
                    <div key={rule.id} className="flex items-center py-1">
                      <input
                        id={`rule-${rule.id}`}
                        type="checkbox"
                        checked={editingRule.ruleIds?.includes(rule.id) || false}
                        onChange={() => toggleRuleSelection(rule.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`rule-${rule.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {rule.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                id="rule-enabled"
                type="checkbox"
                checked={editingRule.enabled}
                onChange={(e) => updateRuleField('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="rule-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Enable this time-based rule
              </label>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveTimeRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Focus & Time Scheduler</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
          <button 
            className="ml-2 text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="mb-4">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-2 px-4 text-sm font-medium ${
                activeTab === 'sessions'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Focus Sessions
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`ml-8 py-2 px-4 text-sm font-medium ${
                activeTab === 'rules'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Time-Based Rules
            </button>
          </nav>
        </div>
      </div>
      
      {activeTab === 'sessions' ? (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white">Scheduled Focus Sessions</h3>
            <button
              onClick={createNewSession}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
            >
              Add Session
            </button>
          </div>
          
          {focusSessions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No focus sessions scheduled. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {focusSessions.map(session => (
                <div 
                  key={session.id} 
                  className={`border ${
                    session.enabled 
                      ? 'border-green-200 dark:border-green-900' 
                      : 'border-gray-200 dark:border-gray-700'
                  } rounded-lg p-3`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        session.enabled ? 'bg-green-500' : 'bg-gray-400'
                      }`}></div>
                      <h4 className="font-medium text-gray-800 dark:text-white">{session.name}</h4>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleSessionEnabled(session)}
                        className={`px-2 py-1 rounded text-xs ${
                          session.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {session.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => setEditingSession(session)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                      <span>{formatDays(session.daysOfWeek)}</span>
                    </div>
                    <div className="mt-1">
                      <span>Tab limit: {session.settings?.tabLimit || 5}</span>
                      {session.settings?.blockDistractions && (
                        <span className="ml-3">Blocks distractions</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white">Time-Based Rules</h3>
            <button
              onClick={createNewTimeRule}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
            >
              Add Rule
            </button>
          </div>
          
          {timeRules.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No time-based rules created. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {timeRules.map(rule => (
                <div 
                  key={rule.id} 
                  className={`border ${
                    rule.enabled 
                      ? 'border-blue-200 dark:border-blue-900' 
                      : 'border-gray-200 dark:border-gray-700'
                  } rounded-lg p-3`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        rule.enabled ? 'bg-blue-500' : 'bg-gray-400'
                      }`}></div>
                      <h4 className="font-medium text-gray-800 dark:text-white">{rule.name}</h4>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleRuleEnabled(rule)}
                        className={`px-2 py-1 rounded text-xs ${
                          rule.enabled
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => setEditingRule(rule)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteTimeRule(rule.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>{formatTime(rule.startTime)} - {formatTime(rule.endTime)}</span>
                      <span>{formatDays(rule.daysOfWeek)}</span>
                    </div>
                    <div className="mt-1">
                      <span>
                        {rule.ruleIds.length} rule{rule.ruleIds.length !== 1 ? 's' : ''} activated
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {renderSessionEditor()}
      {renderRuleEditor()}
    </div>
  );
};

export default FocusScheduler;