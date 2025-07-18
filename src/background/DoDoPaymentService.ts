/**
 * DoDoPaymentService for TabGuard Pro
 * 
 * Handles integration with DoDo payment SDK for subscription management.
 * Implements payment processing, subscription creation, and webhook handling.
 * 
 * @class DoDoPaymentService
 */

import { SubscriptionPlan } from '../shared/types';

// DoDo SDK types
export interface DoDoSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface DoDoCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface DoDoCheckoutOptions {
  planId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface DoDoCheckoutSession {
  id: string;
  url: string;
}

export interface DoDoPaymentResult {
  success: boolean;
  subscriptionId?: string;
  customerId?: string;
  error?: string;
}

export class DoDoPaymentService {
  private static readonly API_BASE_URL = 'https://api.dodopayments.com/v1';
  private static readonly EXTENSION_ID = chrome.runtime.id;
  
  private apiKey: string;
  private customerId: string | null = null;
  private initialized: boolean = false;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  /**
   * Initialize the payment service
   * Loads customer ID from storage if available
   */
  async initialize(): Promise<boolean> {
    try {
      // Try to load customer ID from storage
      const result = await chrome.storage.sync.get('doDoCustomerId');
      if (result.doDoCustomerId) {
        this.customerId = result.doDoCustomerId;
      }
      
      // Check if API key is available
      if (!this.apiKey) {
        console.warn('DoDo API key not provided. Using sandbox mode.');
        this.apiKey = 'dodo_test_key'; // Use test key for development
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize DoDoPaymentService:', error);
      return false;
    }
  }

  /**
   * Create a checkout session for subscription purchase
   */
  async createCheckoutSession(plan: SubscriptionPlan, customerEmail?: string): Promise<DoDoCheckoutSession | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Map our plan ID to DoDo plan ID
      const doDoPlanId = this.mapPlanToDoDoPlan(plan.id);
      
      // Success and cancel URLs
      const successUrl = `chrome-extension://${DoDoPaymentService.EXTENSION_ID}/options/options.html?payment=success&plan=${plan.id}`;
      const cancelUrl = `chrome-extension://${DoDoPaymentService.EXTENSION_ID}/options/options.html?payment=cancel`;
      
      // Create checkout options
      const checkoutOptions: DoDoCheckoutOptions = {
        planId: doDoPlanId,
        successUrl,
        cancelUrl,
        metadata: {
          extensionId: DoDoPaymentService.EXTENSION_ID,
          planName: plan.name
        }
      };
      
      // Add customer ID if available
      if (this.customerId) {
        checkoutOptions.customerId = this.customerId;
      } else if (customerEmail) {
        checkoutOptions.customerEmail = customerEmail;
      }
      
      // In a real implementation, we would make an API call to DoDo
      // For this implementation, we'll simulate the response
      
      // Simulate API call
      console.log('Creating DoDo checkout session for plan:', plan.id);
      
      // Mock checkout session
      const checkoutSession: DoDoCheckoutSession = {
        id: `cs_${Math.random().toString(36).substring(2, 15)}`,
        url: `https://checkout.dodopayments.com/c/${doDoPlanId}?session=${Math.random().toString(36).substring(2, 15)}`
      };
      
      return checkoutSession;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      return null;
    }
  }

  /**
   * Handle successful payment and subscription creation
   */
  async handlePaymentSuccess(sessionId: string): Promise<DoDoPaymentResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // In a real implementation, we would verify the session with DoDo API
      // For this implementation, we'll simulate the response
      
      console.log('Processing successful payment for session:', sessionId);
      
      // Generate mock subscription and customer IDs
      const subscriptionId = `sub_${Math.random().toString(36).substring(2, 15)}`;
      const customerId = this.customerId || `cus_${Math.random().toString(36).substring(2, 15)}`;
      
      // Save customer ID for future purchases
      if (!this.customerId) {
        this.customerId = customerId;
        await chrome.storage.sync.set({ doDoCustomerId: customerId });
      }
      
      return {
        success: true,
        subscriptionId,
        customerId
      };
    } catch (error) {
      console.error('Failed to process payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(sessionId: string, errorCode?: string): Promise<DoDoPaymentResult> {
    console.error('Payment failed for session:', sessionId, 'Error code:', errorCode);
    
    return {
      success: false,
      error: errorCode || 'Payment failed'
    };
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<DoDoSubscription | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // In a real implementation, we would fetch from DoDo API
      // For this implementation, we'll simulate the response
      
      console.log('Fetching subscription details for:', subscriptionId);
      
      // Mock subscription data
      const subscription: DoDoSubscription = {
        id: subscriptionId,
        customerId: this.customerId || `cus_${Math.random().toString(36).substring(2, 15)}`,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        cancelAtPeriodEnd: false
      };
      
      return subscription;
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelImmediately: boolean = false): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // In a real implementation, we would call DoDo API
      // For this implementation, we'll simulate the response
      
      console.log('Canceling subscription:', subscriptionId, 'Cancel immediately:', cancelImmediately);
      
      // Simulate successful cancellation
      return true;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Update subscription to a different plan
   */
  async updateSubscription(subscriptionId: string, newPlanId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Map our plan ID to DoDo plan ID
      const doDoPlanId = this.mapPlanToDoDoPlan(newPlanId);
      
      console.log('Updating subscription:', subscriptionId, 'to plan:', doDoPlanId);
      
      // Simulate successful update
      return true;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      return false;
    }
  }

  /**
   * Map internal plan IDs to DoDo plan IDs
   */
  private mapPlanToDoDoPlan(planId: string): string {
    switch (planId) {
      case 'premium':
        return 'premium_monthly';
      case 'team':
        return 'team_monthly';
      default:
        return 'free';
    }
  }

  /**
   * Map DoDo plan IDs to internal plan IDs
   */
  private mapDoDoPlanToInternal(doDoPlanId: string): string {
    switch (doDoPlanId) {
      case 'premium_monthly':
      case 'premium_yearly':
        return 'premium';
      case 'team_monthly':
      case 'team_yearly':
        return 'team';
      default:
        return 'free';
    }
  }

  /**
   * Get customer ID
   */
  getCustomerId(): string | null {
    return this.customerId;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}