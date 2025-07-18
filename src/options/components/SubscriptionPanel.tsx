import React, { useState, useEffect } from 'react';
import { SubscriptionPlan } from '../../shared/types';

interface SubscriptionPanelProps {
  onUpgrade?: (planId: string) => void;
}

interface SubscriptionState {
  plan: string;
  expiresAt: string | null;
  features: Record<string, boolean>;
  tabLimit: number;
  subscriptionId?: string;
  customerId?: string;
}

const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({ onUpgrade }) => {
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [showEmailInput, setShowEmailInput] = useState<boolean>(false);
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        
        // Get current plan
        const planResponse = await chrome.runtime.sendMessage({ action: 'getCurrentPlan' });
        if (planResponse.error) {
          throw new Error(planResponse.error);
        }
        
        // Get available plans
        const plansResponse = await chrome.runtime.sendMessage({ action: 'getAvailablePlans' });
        if (plansResponse.error) {
          throw new Error(plansResponse.error);
        }
        
        // Get available features
        const featuresResponse = await chrome.runtime.sendMessage({ action: 'getAvailableFeatures' });
        if (featuresResponse.error) {
          throw new Error(featuresResponse.error);
        }
        
        // Get subscription state
        const stateResponse = await chrome.runtime.sendMessage({ action: 'getSubscriptionState' });
        if (stateResponse.error) {
          throw new Error(stateResponse.error);
        }
        
        setCurrentPlan(planResponse.plan);
        setAvailablePlans(plansResponse.plans || []);
        setFeatures(featuresResponse.features || []);
        setSubscriptionState(stateResponse.state);
        setError(null);
        
        // Check URL parameters for payment status
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const sessionId = urlParams.get('session_id');
        
        if (paymentStatus === 'success' && sessionId) {
          await handlePaymentSuccess(sessionId);
        } else if (paymentStatus === 'cancel') {
          setError('Payment was cancelled. Please try again if you wish to upgrade.');
        }
      } catch (err) {
        setError(`Failed to load subscription data: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error loading subscription data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, []);

  const handlePaymentSuccess = async (sessionId: string) => {
    try {
      setProcessingPayment(true);
      setError(null);
      
      // Process successful payment
      const response = await chrome.runtime.sendMessage({
        action: 'processPaymentSuccess',
        sessionId
      });
      
      if (response.success) {
        // Refresh subscription data
        const planResponse = await chrome.runtime.sendMessage({ action: 'getCurrentPlan' });
        const stateResponse = await chrome.runtime.sendMessage({ action: 'getSubscriptionState' });
        
        setCurrentPlan(planResponse.plan);
        setSubscriptionState(stateResponse.state);
        
        // Call parent callback if provided
        if (onUpgrade) {
          onUpgrade(planResponse.plan.id);
        }
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        throw new Error(response.error || 'Payment processing failed');
      }
    } catch (err) {
      setError(`Failed to process payment: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error processing payment:', err);
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // For free plan, use direct upgrade
      if (planId === 'free') {
        const response = await chrome.runtime.sendMessage({ 
          action: 'upgradeSubscription', 
          planId 
        });
        
        if (response.success) {
          // Refresh current plan after upgrade
          const planResponse = await chrome.runtime.sendMessage({ action: 'getCurrentPlan' });
          setCurrentPlan(planResponse.plan);
          
          // Call parent callback if provided
          if (onUpgrade) {
            onUpgrade(planId);
          }
        } else {
          throw new Error(response.error || 'Upgrade failed');
        }
      } else {
        // For paid plans, create checkout session
        if (!subscriptionState?.customerId) {
          // Show email input if no customer ID exists
          setShowEmailInput(true);
          return;
        }
        
        await initiateCheckout(planId);
      }
    } catch (err) {
      setError(`Failed to upgrade subscription: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error upgrading subscription:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const initiateCheckout = async (planId: string, email?: string) => {
    try {
      setLoading(true);
      
      // Create checkout session
      const response = await chrome.runtime.sendMessage({
        action: 'createCheckoutSession',
        planId,
        customerEmail: email
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.checkoutSession?.url) {
        // Redirect to checkout URL
        window.location.href = response.checkoutSession.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(`Failed to create checkout session: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error creating checkout session:', err);
      setLoading(false);
    }
  };
  
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerEmail || !customerEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Get the plan ID from the form
    const form = e.target as HTMLFormElement;
    const planId = form.getAttribute('data-plan-id');
    
    if (!planId) {
      setError('No plan selected');
      return;
    }
    
    // Initiate checkout with email
    initiateCheckout(planId, customerEmail);
    setShowEmailInput(false);
  };
  
  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cancel subscription
      const response = await chrome.runtime.sendMessage({
        action: 'cancelSubscription',
        cancelImmediately: false // Cancel at period end
      });
      
      if (response.success) {
        // Refresh subscription data
        const stateResponse = await chrome.runtime.sendMessage({ action: 'getSubscriptionState' });
        setSubscriptionState(stateResponse.state);
        
        // Show success message
        alert('Your subscription has been cancelled and will end at the current billing period.');
      } else {
        throw new Error(response.error || 'Cancellation failed');
      }
    } catch (err) {
      setError(`Failed to cancel subscription: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error cancelling subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading subscription information...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        {error}
      </div>
    );
  }

  // Email input form for new customers
  if (showEmailInput) {
    const selectedPlan = availablePlans.find(plan => plan.id !== 'free' && plan.id !== currentPlan?.id);
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Enter Your Email</h2>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="mb-2">To continue with your subscription to <strong>{selectedPlan?.name}</strong>, please enter your email address:</p>
          
          <form onSubmit={handleEmailSubmit} data-plan-id={selectedPlan?.id}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                id="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@example.com"
                required
              />
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setShowEmailInput(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  
  // Processing payment screen
  if (processingPayment) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Processing Payment</h2>
        <div className="flex justify-center mb-4">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p>Please wait while we process your payment...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Subscription</h2>
      
      {/* Current Plan */}
      {currentPlan && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Current Plan: {currentPlan.name}</h3>
          <div className="mt-2">
            <p>Tab Limit: <span className="font-medium">{currentPlan.tabLimit} tabs</span></p>
            <p>AI Insights: <span className="font-medium">{currentPlan.aiInsights ? 'Included' : 'Not included'}</span></p>
            <p>Team Features: <span className="font-medium">{currentPlan.teamFeatures ? 'Included' : 'Not included'}</span></p>
            
            {/* Subscription details */}
            {subscriptionState?.subscriptionId && subscriptionState.plan !== 'free' && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm">
                  <span className="font-medium">Subscription ID:</span> {subscriptionState.subscriptionId.substring(0, 8)}...
                </p>
                {subscriptionState.expiresAt && (
                  <p className="text-sm">
                    <span className="font-medium">Renews on:</span> {new Date(subscriptionState.expiresAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={handleCancelSubscription}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Available Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {availablePlans.map((plan) => (
          <div 
            key={plan.id} 
            className={`border rounded-lg p-4 ${currentPlan?.id === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
          >
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="text-2xl font-bold my-2">${plan.price.toFixed(2)}<span className="text-sm text-gray-500">/month</span></p>
            
            <ul className="my-4 space-y-2">
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to {plan.tabLimit} tabs
              </li>
              {plan.aiInsights && (
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI-powered insights
                </li>
              )}
              {plan.teamFeatures && (
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Team management
                </li>
              )}
            </ul>
            
            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={currentPlan?.id === plan.id || loading}
              className={`w-full py-2 px-4 rounded-md ${
                currentPlan?.id === plan.id
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {currentPlan?.id === plan.id ? 'Current Plan' : plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>
      
      {/* Payment Security Notice */}
      {availablePlans.some(plan => plan.price > 0) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <h4 className="font-medium">Secure Payment Processing</h4>
          </div>
          <p className="text-sm text-gray-600">
            All payments are securely processed by DoDo Payments. Your payment information is never stored on our servers.
          </p>
        </div>
      )}
      
      {/* Features */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Available Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <div key={feature.id} className="flex items-start p-3 border border-gray-200 rounded-lg">
              <svg className="w-5 h-5 mr-3 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-medium">{feature.name}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPanel;