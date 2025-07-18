/**
 * SubscriptionManager for TabGuard Pro
 * 
 * Handles subscription plan validation, feature flags, and premium capabilities.
 * Implements free tier limitations and subscription state persistence.
 * Integrates with DoDoPaymentService for payment processing.
 * 
 * @class SubscriptionManager
 */

import { SubscriptionPlan } from '../shared/types';
import { StorageManager } from '../shared/StorageManager';
import { DoDoPaymentService, DoDoSubscription, DoDoCheckoutSession, DoDoPaymentResult } from './DoDoPaymentService';

/**
 * Subscription state interface for persistence
 */
export interface SubscriptionState {
  plan: string;
  expiresAt: string | null;
  features: Record<string, boolean>;
  tabLimit: number;
  subscriptionId?: string;
  customerId?: string;
}

/**
 * Feature flag interface
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  availableInPlans: string[];
}

export class SubscriptionManager {
  private static readonly SUBSCRIPTION_KEY = 'subscriptionState';
  private static readonly DODO_API_KEY = 'dodo_live_key_tabguard'; // Would be configured in production
  
  // Available subscription plans
  private static readonly PLANS: Record<string, SubscriptionPlan> = {
    free: {
      id: 'free',
      name: 'Free',
      price: 0,
      features: ['basic_tab_limit', 'notifications', 'basic_rules'],
      tabLimit: 5, // Free tier limit of 5 tabs
      aiInsights: false,
      teamFeatures: false
    },
    premium: {
      id: 'premium',
      name: 'Premium',
      price: 4.99,
      features: [
        'basic_tab_limit', 
        'unlimited_tabs', 
        'notifications', 
        'basic_rules',
        'advanced_rules',
        'ai_insights',
        'auto_close',
        'custom_themes',
        'data_export'
      ],
      tabLimit: 100, // Premium tier with higher limit
      aiInsights: true,
      teamFeatures: false
    },
    team: {
      id: 'team',
      name: 'Team',
      price: 9.99,
      features: [
        'basic_tab_limit', 
        'unlimited_tabs', 
        'notifications', 
        'basic_rules',
        'advanced_rules',
        'ai_insights',
        'auto_close',
        'custom_themes',
        'data_export',
        'team_management',
        'policy_enforcement',
        'team_analytics'
      ],
      tabLimit: 500, // Team tier with highest limit
      aiInsights: true,
      teamFeatures: true
    }
  };

  // Feature flags with descriptions
  private static readonly FEATURE_FLAGS: FeatureFlag[] = [
    {
      id: 'basic_tab_limit',
      name: 'Basic Tab Limit',
      description: 'Limit the number of open tabs (up to 5)',
      availableInPlans: ['free', 'premium', 'team']
    },
    {
      id: 'unlimited_tabs',
      name: 'Unlimited Tabs',
      description: 'Set higher tab limits (up to 100 for Premium, 500 for Team)',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Receive notifications about tab limits',
      availableInPlans: ['free', 'premium', 'team']
    },
    {
      id: 'basic_rules',
      name: 'Basic Rules',
      description: 'Create simple tab management rules',
      availableInPlans: ['free', 'premium', 'team']
    },
    {
      id: 'advanced_rules',
      name: 'Advanced Rules',
      description: 'Create complex rules with multiple conditions',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'ai_insights',
      name: 'AI Insights',
      description: 'Get AI-powered productivity insights',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'auto_close',
      name: 'Auto-Close',
      description: 'Automatically close inactive tabs',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'custom_themes',
      name: 'Custom Themes',
      description: 'Customize the extension appearance',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'data_export',
      name: 'Data Export',
      description: 'Export productivity data and settings',
      availableInPlans: ['premium', 'team']
    },
    {
      id: 'team_management',
      name: 'Team Management',
      description: 'Manage team members and permissions',
      availableInPlans: ['team']
    },
    {
      id: 'policy_enforcement',
      name: 'Policy Enforcement',
      description: 'Enforce tab policies across team',
      availableInPlans: ['team']
    },
    {
      id: 'team_analytics',
      name: 'Team Analytics',
      description: 'View team productivity analytics',
      availableInPlans: ['team']
    }
  ];

  // Default subscription state (free tier)
  private static readonly DEFAULT_STATE: SubscriptionState = {
    plan: 'free',
    expiresAt: null,
    features: {},
    tabLimit: 5
  };

  private subscriptionState: SubscriptionState;
  private storageManager: StorageManager;
  private paymentService: DoDoPaymentService;
  private initialized: boolean = false;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
    this.subscriptionState = { ...SubscriptionManager.DEFAULT_STATE };
    this.paymentService = new DoDoPaymentService(SubscriptionManager.DODO_API_KEY);
  }

  /**
   * Initialize subscription manager
   * Loads subscription state from storage or creates default state
   */
  async initialize(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(SubscriptionManager.SUBSCRIPTION_KEY);
      const storedState = result[SubscriptionManager.SUBSCRIPTION_KEY];

      if (storedState) {
        this.subscriptionState = storedState;
      } else {
        // Initialize with default free tier state
        this.subscriptionState = { ...SubscriptionManager.DEFAULT_STATE };
        await this.saveSubscriptionState();
      }

      // Validate subscription on initialization
      await this.validateSubscription();
      
      this.initialized = true;
      console.log('SubscriptionManager initialized with plan:', this.subscriptionState.plan);
    } catch (error) {
      console.error('Failed to initialize SubscriptionManager:', error);
      // Fall back to default state
      this.subscriptionState = { ...SubscriptionManager.DEFAULT_STATE };
      this.initialized = true;
    }
  }

  /**
   * Get current subscription plan
   */
  async getCurrentPlan(): Promise<SubscriptionPlan> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate subscription before returning plan
    await this.validateSubscription();

    const planId = this.subscriptionState.plan;
    return SubscriptionManager.PLANS[planId] || SubscriptionManager.PLANS.free;
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeatureAccess(featureId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate subscription before checking feature access
    await this.validateSubscription();

    const currentPlan = await this.getCurrentPlan();
    
    // Check if feature is available in current plan
    return currentPlan.features.includes(featureId);
  }

  /**
   * Get all available features for current plan
   */
  async getAvailableFeatures(): Promise<FeatureFlag[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const currentPlan = await this.getCurrentPlan();
    
    return SubscriptionManager.FEATURE_FLAGS.filter(feature => 
      feature.availableInPlans.includes(currentPlan.id)
    );
  }

  /**
   * Get tab limit based on current subscription
   */
  async getTabLimit(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate subscription before returning tab limit
    await this.validateSubscription();

    const currentPlan = await this.getCurrentPlan();
    return currentPlan.tabLimit;
  }

  /**
   * Upgrade subscription to a new plan
   */
  async upgradeSubscription(planId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if plan exists
    if (!SubscriptionManager.PLANS[planId]) {
      console.error(`Invalid plan ID: ${planId}`);
      return false;
    }

    try {
      // Set new plan
      this.subscriptionState.plan = planId;
      
      // Set expiry date for paid plans (1 month from now)
      if (planId !== 'free') {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        this.subscriptionState.expiresAt = expiryDate.toISOString();
      } else {
        this.subscriptionState.expiresAt = null;
      }

      // Update tab limit based on plan
      this.subscriptionState.tabLimit = SubscriptionManager.PLANS[planId].tabLimit;

      // Save updated state
      await this.saveSubscriptionState();
      
      console.log(`Subscription upgraded to ${planId}`);
      return true;
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      return false;
    }
  }

  /**
   * Validate subscription status
   * Checks expiry date and downgrades if expired
   */
  async validateSubscription(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Free plan is always valid
    if (this.subscriptionState.plan === 'free') {
      return true;
    }

    // Check expiry date for paid plans
    if (this.subscriptionState.expiresAt) {
      const expiryDate = new Date(this.subscriptionState.expiresAt);
      const now = new Date();

      if (expiryDate < now) {
        console.log('Subscription expired, downgrading to free plan');
        
        // Downgrade to free plan
        this.subscriptionState.plan = 'free';
        this.subscriptionState.expiresAt = null;
        this.subscriptionState.tabLimit = SubscriptionManager.PLANS.free.tabLimit;
        
        // Save updated state
        await this.saveSubscriptionState();
        
        return false;
      }
    }

    return true;
  }

  /**
   * Set subscription expiry date (for testing)
   */
  async setSubscriptionExpiry(date: Date): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.subscriptionState.expiresAt = date.toISOString();
    await this.saveSubscriptionState();
  }

  /**
   * Save subscription state to storage
   */
  private async saveSubscriptionState(): Promise<void> {
    try {
      await chrome.storage.sync.set({
        [SubscriptionManager.SUBSCRIPTION_KEY]: this.subscriptionState
      });
    } catch (error) {
      console.error('Failed to save subscription state:', error);
      throw error;
    }
  }

  /**
   * Get all available subscription plans
   */
  getAvailablePlans(): SubscriptionPlan[] {
    return Object.values(SubscriptionManager.PLANS);
  }

  /**
   * Get subscription state for debugging/testing
   */
  getSubscriptionState(): SubscriptionState {
    return { ...this.subscriptionState };
  }

  /**
   * Initialize payment service
   */
  async initializePaymentService(): Promise<boolean> {
    return await this.paymentService.initialize();
  }

  /**
   * Create checkout session for subscription purchase
   */
  async createCheckoutSession(planId: string, customerEmail?: string): Promise<DoDoCheckoutSession | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Initialize payment service if needed
    if (!await this.initializePaymentService()) {
      console.error('Failed to initialize payment service');
      return null;
    }

    // Get plan details
    const plan = SubscriptionManager.PLANS[planId];
    if (!plan) {
      console.error(`Invalid plan ID: ${planId}`);
      return null;
    }

    // Create checkout session
    return await this.paymentService.createCheckoutSession(plan, customerEmail);
  }

  /**
   * Process successful payment
   */
  async processPaymentSuccess(sessionId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Process payment with DoDo service
      const result = await this.paymentService.handlePaymentSuccess(sessionId);
      
      if (!result.success) {
        console.error('Payment processing failed:', result.error);
        return false;
      }

      // Extract subscription and customer IDs
      const { subscriptionId, customerId } = result;
      
      if (!subscriptionId) {
        console.error('No subscription ID returned from payment service');
        return false;
      }

      // Get subscription details from DoDo
      const subscription = await this.paymentService.getSubscription(subscriptionId);
      
      if (!subscription) {
        console.error('Failed to fetch subscription details');
        return false;
      }

      // Map DoDo plan to our internal plan
      let planId: string;
      if (subscription.planId.includes('premium')) {
        planId = 'premium';
      } else if (subscription.planId.includes('team')) {
        planId = 'team';
      } else {
        planId = 'free';
      }

      // Update subscription state
      this.subscriptionState.plan = planId;
      this.subscriptionState.subscriptionId = subscriptionId;
      this.subscriptionState.customerId = customerId || this.subscriptionState.customerId;
      
      // Set expiry date based on subscription period end
      this.subscriptionState.expiresAt = subscription.currentPeriodEnd;
      
      // Update tab limit based on plan
      this.subscriptionState.tabLimit = SubscriptionManager.PLANS[planId].tabLimit;

      // Save updated state
      await this.saveSubscriptionState();
      
      console.log(`Subscription activated: ${planId}, expires: ${subscription.currentPeriodEnd}`);
      return true;
    } catch (error) {
      console.error('Failed to process payment success:', error);
      return false;
    }
  }

  /**
   * Process payment failure
   */
  async processPaymentFailure(sessionId: string, errorCode?: string): Promise<void> {
    await this.paymentService.handlePaymentFailure(sessionId, errorCode);
    console.error('Payment failed for session:', sessionId, 'Error code:', errorCode);
  }

  /**
   * Cancel current subscription
   */
  async cancelSubscription(cancelImmediately: boolean = false): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if user has an active subscription
    if (this.subscriptionState.plan === 'free' || !this.subscriptionState.subscriptionId) {
      console.warn('No active subscription to cancel');
      return false;
    }

    try {
      // Cancel subscription with DoDo service
      const result = await this.paymentService.cancelSubscription(
        this.subscriptionState.subscriptionId,
        cancelImmediately
      );
      
      if (!result) {
        console.error('Failed to cancel subscription');
        return false;
      }

      // If cancelling immediately, downgrade to free plan now
      if (cancelImmediately) {
        this.subscriptionState.plan = 'free';
        this.subscriptionState.expiresAt = null;
        this.subscriptionState.tabLimit = SubscriptionManager.PLANS.free.tabLimit;
        this.subscriptionState.subscriptionId = undefined;
      }

      // Save updated state
      await this.saveSubscriptionState();
      
      console.log(`Subscription cancelled, immediate: ${cancelImmediately}`);
      return true;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Upgrade or downgrade subscription to a different plan
   */
  async changeSubscriptionPlan(newPlanId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if plan exists
    if (!SubscriptionManager.PLANS[newPlanId]) {
      console.error(`Invalid plan ID: ${newPlanId}`);
      return false;
    }

    // Check if user has an active subscription
    if (!this.subscriptionState.subscriptionId) {
      console.warn('No active subscription to change');
      
      // Create a new subscription instead
      const checkoutSession = await this.createCheckoutSession(newPlanId);
      return !!checkoutSession;
    }

    try {
      // Update subscription with DoDo service
      const result = await this.paymentService.updateSubscription(
        this.subscriptionState.subscriptionId,
        newPlanId
      );
      
      if (!result) {
        console.error('Failed to update subscription plan');
        return false;
      }

      // Update subscription state
      this.subscriptionState.plan = newPlanId;
      
      // Update tab limit based on plan
      this.subscriptionState.tabLimit = SubscriptionManager.PLANS[newPlanId].tabLimit;

      // Save updated state
      await this.saveSubscriptionState();
      
      console.log(`Subscription changed to ${newPlanId}`);
      return true;
    } catch (error) {
      console.error('Failed to change subscription plan:', error);
      return false;
    }
  }

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Free plan is not considered an active subscription
    if (this.subscriptionState.plan === 'free') {
      return false;
    }

    // Validate subscription before returning status
    return await this.validateSubscription();
  }
}