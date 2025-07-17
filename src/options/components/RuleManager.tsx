import React, { useState, useEffect } from 'react';
import { TabRule, RuleCondition, RuleAction } from '@/shared/types';
import { v4 as uuidv4 } from 'uuid';

interface RuleManagerProps {
  rules: TabRule[];
  onRulesChange: (rules: TabRule[]) => void;
  className?: string;
}

const RuleManager: React.FC<RuleManagerProps> = ({
  rules = [],
  onRulesChange,
  className = ''
}) => {
  const [localRules, setLocalRules] = useState<TabRule[]>(rules);
  const [editingRule, setEditingRule] = useState<TabRule | null>(null);
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);

  useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  const handleRuleToggle = (ruleId: string) => {
    const updatedRules = localRules.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    setLocalRules(updatedRules);
    onRulesChange(updatedRules);
  };

  const handleRuleDelete = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      const updatedRules = localRules.filter(rule => rule.id !== ruleId);
      setLocalRules(updatedRules);
      onRulesChange(updatedRules);
    }
  };

  const handleRuleEdit = (rule: TabRule) => {
    setEditingRule({ ...rule });
    setIsAddingRule(false);
  };

  const handleAddNewRule = () => {
    const newRule: TabRule = {
      id: uuidv4(),
      name: 'New Rule',
      condition: {
        type: 'domain',
        operator: 'contains',
        value: ''
      },
      action: {
        type: 'limit_tabs',
        value: 5
      },
      priority: localRules.length,
      enabled: true
    };
    
    setEditingRule(newRule);
    setIsAddingRule(true);
  };

  const handleRuleSave = () => {
    if (!editingRule) return;
    
    let updatedRules: TabRule[];
    
    if (isAddingRule) {
      updatedRules = [...localRules, editingRule];
    } else {
      updatedRules = localRules.map(rule => 
        rule.id === editingRule.id ? editingRule : rule
      );
    }
    
    setLocalRules(updatedRules);
    onRulesChange(updatedRules);
    setEditingRule(null);
    setIsAddingRule(false);
  };

  const handleRuleCancel = () => {
    setEditingRule(null);
    setIsAddingRule(false);
  };

  const handleRuleFieldChange = (field: keyof TabRule, value: any) => {
    if (!editingRule) return;
    setEditingRule({ ...editingRule, [field]: value });
  };

  const handleConditionChange = (field: keyof RuleCondition, value: any) => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      condition: { ...editingRule.condition, [field]: value }
    });
  };

  const handleActionChange = (field: keyof RuleAction, value: any) => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      action: { ...editingRule.action, [field]: value }
    });
  };

  const moveRule = (ruleId: string, direction: 'up' | 'down') => {
    const index = localRules.findIndex(rule => rule.id === ruleId);
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === localRules.length - 1)
    ) {
      return;
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedRules = [...localRules];
    const rule = updatedRules[index];
    
    // Remove the rule from its current position
    updatedRules.splice(index, 1);
    // Insert it at the new position
    updatedRules.splice(newIndex, 0, rule);
    
    // Update priorities
    const rulesWithUpdatedPriorities = updatedRules.map((rule, idx) => ({
      ...rule,
      priority: idx
    }));
    
    setLocalRules(rulesWithUpdatedPriorities);
    onRulesChange(rulesWithUpdatedPriorities);
  };

  return (
    <div className={`rule-manager ${className}`}>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tab Rules</h3>
        <button
          onClick={handleAddNewRule}
          className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Add New Rule
        </button>
      </div>
      
      {localRules.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-md">
          <p className="text-gray-500 dark:text-gray-400">
            No rules defined yet. Rules allow you to set specific tab limits for different websites.
          </p>
          <button
            onClick={handleAddNewRule}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {localRules.map(rule => (
            <div 
              key={rule.id}
              className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative inline-block w-10 align-middle select-none">
                    <input 
                      type="checkbox" 
                      id={`rule-toggle-${rule.id}`} 
                      checked={rule.enabled}
                      onChange={() => handleRuleToggle(rule.id)}
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                    />
                    <label 
                      htmlFor={`rule-toggle-${rule.id}`} 
                      className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer"
                    ></label>
                  </div>
                  <span className={`font-medium ${rule.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {rule.name}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => moveRule(rule.id, 'up')}
                    disabled={localRules.indexOf(rule) === 0}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveRule(rule.id, 'down')}
                    disabled={localRules.indexOf(rule) === localRules.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRuleEdit(rule)}
                    className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Edit rule"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleRuleDelete(rule.id)}
                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete rule"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                    {rule.condition.type === 'domain' ? 'Domain' : 
                     rule.condition.type === 'category' ? 'Category' :
                     rule.condition.type === 'time' ? 'Time' : 'Tab Count'}
                    {' '}
                    {rule.condition.operator === 'equals' ? 'equals' :
                     rule.condition.operator === 'contains' ? 'contains' :
                     rule.condition.operator === 'greater_than' ? 'greater than' : 'less than'}
                    {' '}
                    {rule.condition.value}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                    {rule.action.type === 'limit_tabs' ? 'Limit tabs to' :
                     rule.action.type === 'close_tabs' ? 'Close tabs after' :
                     'Block new tabs when'} {rule.action.value}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                    Priority: {rule.priority + 1}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Rule Editor Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {isAddingRule ? 'Add New Rule' : 'Edit Rule'}
              </h3>
              
              <div className="space-y-4">
                {/* Rule Name */}
                <div>
                  <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rule Name
                  </label>
                  <input
                    id="rule-name"
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => handleRuleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                    placeholder="Enter rule name"
                  />
                </div>
                
                {/* Condition */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Condition</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="condition-type" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        id="condition-type"
                        value={editingRule.condition.type}
                        onChange={(e) => handleConditionChange('type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                      >
                        <option value="domain">Domain</option>
                        <option value="category">Category</option>
                        <option value="time">Time</option>
                        <option value="tab_count">Tab Count</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="condition-operator" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Operator
                      </label>
                      <select
                        id="condition-operator"
                        value={editingRule.condition.operator}
                        onChange={(e) => handleConditionChange('operator', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                      >
                        {(editingRule.condition.type === 'domain' || editingRule.condition.type === 'category') && (
                          <>
                            <option value="equals">Equals</option>
                            <option value="contains">Contains</option>
                          </>
                        )}
                        {(editingRule.condition.type === 'time' || editingRule.condition.type === 'tab_count') && (
                          <>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                          </>
                        )}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="condition-value" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Value
                      </label>
                      {(editingRule.condition.type === 'domain' || editingRule.condition.type === 'category') ? (
                        <input
                          id="condition-value"
                          type="text"
                          value={editingRule.condition.value as string}
                          onChange={(e) => handleConditionChange('value', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                          placeholder={editingRule.condition.type === 'domain' ? "e.g., example.com" : "e.g., social"}
                        />
                      ) : (
                        <input
                          id="condition-value"
                          type="number"
                          value={editingRule.condition.value as number}
                          onChange={(e) => handleConditionChange('value', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                          placeholder="Enter value"
                          min="0"
                        />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Action</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="action-type" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        id="action-type"
                        value={editingRule.action.type}
                        onChange={(e) => handleActionChange('type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                      >
                        <option value="limit_tabs">Limit Tabs</option>
                        <option value="close_tabs">Close Tabs</option>
                        <option value="block_new_tabs">Block New Tabs</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="action-value" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Value
                      </label>
                      <input
                        id="action-value"
                        type="number"
                        value={editingRule.action.value}
                        onChange={(e) => handleActionChange('value', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                        placeholder="Enter value"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Priority */}
                <div>
                  <label htmlFor="rule-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority (Lower number = higher priority)
                  </label>
                  <input
                    id="rule-priority"
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) => handleRuleFieldChange('priority', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                </div>
                
                {/* Enabled */}
                <div className="flex items-center">
                  <input
                    id="rule-enabled"
                    type="checkbox"
                    checked={editingRule.enabled}
                    onChange={(e) => handleRuleFieldChange('enabled', e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-700"
                  />
                  <label htmlFor="rule-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Rule enabled
                  </label>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={handleRuleCancel}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRuleSave}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {isAddingRule ? 'Add Rule' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleManager;