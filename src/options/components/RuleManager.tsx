import React, { useState, useEffect } from 'react';
import { TabRule, RuleCondition, RuleAction, WebsiteCategory, RuleConditionType } from '@/shared/types';
import { v4 as uuidv4 } from 'uuid';
import { RuleEngine } from '@/background/RuleEngine';

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
    const [selectedCategory, setSelectedCategory] = useState<WebsiteCategory>('social');
    const [domainExamples, setDomainExamples] = useState<string[]>([]);

    useEffect(() => {
        setLocalRules(rules);
    }, [rules]);

    useEffect(() => {
        if (selectedCategory) {
            setDomainExamples(RuleEngine.getDomainExamplesForCategory(selectedCategory));
        }
    }, [selectedCategory]);

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

        // Set selected category if this is a category rule
        if ('type' in rule.condition && rule.condition.type === 'category') {
            setSelectedCategory(rule.condition.value as WebsiteCategory);
        }
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

    const handleConditionChange = (field: string, value: any) => {
        if (!editingRule) return;

        // Handle special case for category selection
        if (field === 'type' && value === 'category') {
            setEditingRule({
                ...editingRule,
                condition: {
                    type: 'category' as RuleConditionType,
                    operator: 'equals',
                    value: selectedCategory
                }
            });
            return;
        }

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

    const handleCategoryChange = (category: WebsiteCategory) => {
        setSelectedCategory(category);

        if (editingRule && 'type' in editingRule.condition && editingRule.condition.type === 'category') {
            setEditingRule({
                ...editingRule,
                condition: { ...editingRule.condition, value: category }
            });
        }
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

    const renderRuleConditionSummary = (rule: TabRule) => {
        if (!('type' in rule.condition)) {
            return <span>Complex condition</span>;
        }

        const condition = rule.condition;

        switch (condition.type) {
            case 'domain':
                return (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                        Domain {condition.operator === 'equals' ? 'equals' :
                            condition.operator === 'contains' ? 'contains' :
                                condition.operator === 'not_equals' ? 'not equals' : 'matches'} {condition.value}
                    </span>
                );

            case 'category':
                return (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full">
                        Category {condition.operator === 'equals' ? 'is' :
                            condition.operator === 'not_equals' ? 'is not' :
                                'in'} {condition.value}
                    </span>
                );

            case 'time':
                return (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                        Time {condition.operator === 'equals' ? 'equals' :
                            condition.operator === 'greater_than' ? 'after' :
                                condition.operator === 'less_than' ? 'before' :
                                    condition.operator === 'in_range' ? 'between' : 'not'} {condition.value}
                    </span>
                );

            case 'tab_count':
                return (
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                        Tab count {condition.operator === 'equals' ? 'equals' :
                            condition.operator === 'greater_than' ? 'greater than' :
                                condition.operator === 'less_than' ? 'less than' :
                                    condition.operator === 'in_range' ? 'between' : 'not'} {condition.value}
                    </span>
                );

            default:
                return (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                        {condition.type} {condition.operator} {condition.value}
                    </span>
                );
        }
    };

    const renderRuleActionSummary = (rule: TabRule) => {
        const action = rule.action;

        switch (action.type) {
            case 'limit_tabs':
                return (
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                        Limit tabs to {action.value}
                    </span>
                );

            case 'close_tabs':
                return (
                    <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                        Close tabs after {action.value} minutes
                    </span>
                );

            case 'block_new_tabs':
                return (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full">
                        Block new tabs {action.value > 0 ? `when count >= ${action.value}` : ''}
                    </span>
                );

            default:
                return (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                        {action.type} {action.value}
                    </span>
                );
        }
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
                                    {renderRuleConditionSummary(rule)}
                                    {renderRuleActionSummary(rule)}
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
                                                value={'type' in editingRule.condition ? editingRule.condition.type : ''}
                                                onChange={(e) => handleConditionChange('type', e.target.value)}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                            >
                                                <option value="domain">Domain</option>
                                                <option value="category">Category</option>
                                                <option value="time">Time</option>
                                                <option value="tab_count">Tab Count</option>
                                                <option value="day_of_week">Day of Week</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor="condition-operator" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Operator
                                            </label>
                                            <select
                                                id="condition-operator"
                                                value={'operator' in editingRule.condition ? editingRule.condition.operator : ''}
                                                onChange={(e) => handleConditionChange('operator', e.target.value)}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                            >
                                                {'type' in editingRule.condition && (
                                                    <>
                                                        {(editingRule.condition.type === 'domain' || editingRule.condition.type === 'category') && (
                                                            <>
                                                                <option value="equals">Equals</option>
                                                                <option value="contains">Contains</option>
                                                                <option value="not_equals">Not Equals</option>
                                                            </>
                                                        )}
                                                        {(editingRule.condition.type === 'time' || editingRule.condition.type === 'tab_count') && (
                                                            <>
                                                                <option value="equals">Equals</option>
                                                                <option value="greater_than">Greater Than</option>
                                                                <option value="less_than">Less Than</option>
                                                                <option value="in_range">In Range</option>
                                                            </>
                                                        )}
                                                        {editingRule.condition.type === 'day_of_week' && (
                                                            <>
                                                                <option value="equals">Equals</option>
                                                                <option value="not_equals">Not Equals</option>
                                                                <option value="in_range">In Range</option>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor="condition-value" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Value
                                            </label>
                                            {'type' in editingRule.condition && (
                                                <>
                                                    {editingRule.condition.type === 'domain' && (
                                                        <input
                                                            id="condition-value"
                                                            type="text"
                                                            value={editingRule.condition.value as string}
                                                            onChange={(e) => handleConditionChange('value', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                                            placeholder="e.g., example.com or *.example.com"
                                                        />
                                                    )}

                                                    {editingRule.condition.type === 'category' && (
                                                        <select
                                                            id="condition-value"
                                                            value={editingRule.condition.value as string}
                                                            onChange={(e) => handleCategoryChange(e.target.value as WebsiteCategory)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                                        >
                                                            <option value="work">Work</option>
                                                            <option value="social">Social</option>
                                                            <option value="entertainment">Entertainment</option>
                                                            <option value="news">News</option>
                                                            <option value="shopping">Shopping</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    )}

                                                    {(editingRule.condition.type === 'time' ||
                                                        editingRule.condition.type === 'tab_count' ||
                                                        editingRule.condition.type === 'day_of_week') && (
                                                            <>
                                                                {editingRule.condition.operator === 'in_range' ? (
                                                                    <div className="flex items-center space-x-2">
                                                                        <input
                                                                            type="number"
                                                                            value={'type' in editingRule.condition ? (editingRule.condition.value as [number, number])[0] || 0 : 0}
                                                                            onChange={(e) => {
                                                                                const min = parseInt(e.target.value) || 0;
                                                                                const max = 'type' in editingRule.condition && Array.isArray(editingRule.condition.value) ?
                                                                                    editingRule.condition.value[1] : 0;
                                                                                handleConditionChange('value', [min, max]);
                                                                            }}
                                                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                                                            min="0"
                                                                        />
                                                                        <span className="text-gray-500 dark:text-gray-400">to</span>
                                                                        <input
                                                                            type="number"
                                                                            value={'type' in editingRule.condition ? (editingRule.condition.value as [number, number])[1] || 0 : 0}
                                                                            onChange={(e) => {
                                                                                const max = parseInt(e.target.value) || 0;
                                                                                const min = 'type' in editingRule.condition && Array.isArray(editingRule.condition.value) ?
                                                                                    editingRule.condition.value[0] : 0;
                                                                                handleConditionChange('value', [min, max]);
                                                                            }}
                                                                            className="w-1/2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                                                            min="0"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        id="condition-value"
                                                                        type="number"
                                                                        value={'type' in editingRule.condition ? editingRule.condition.value as number : 0}
                                                                        onChange={(e) => handleConditionChange('value', parseInt(e.target.value) || 0)}
                                                                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                                                        placeholder="Enter value"
                                                                        min="0"
                                                                    />
                                                                )}
                                                            </>
                                                        )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Domain examples for category */}
                                    {'type' in editingRule.condition && editingRule.condition.type === 'category' && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Example domains: {domainExamples.join(', ')}
                                            </p>
                                        </div>
                                    )}
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
                                                {editingRule.action.type === 'limit_tabs' ? 'Max Tabs' :
                                                    editingRule.action.type === 'close_tabs' ? 'After Minutes' :
                                                        'When Tab Count ≥'}
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