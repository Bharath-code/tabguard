import { DoDoPaymentService } from '../DoDoPaymentService';
import { SubscriptionPlan } from '../../shared/types';

// Mock chrome.storage.sync
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    id: 'test_extension_id'
  }
} as any;

describe('DoDoPaymentService', () => {
  let paymentService: DoDoPaymentService;
  const testPlan: SubscriptionPlan = {
    id: 'premium',
    name: 'Premium',
    price: 4.99,
    features: ['basic_tab_limit', 'unlimited_tabs'],
    tabLimit: 100,
    aiInsights: true,
    teamFeatures: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new DoDoPaymentService('test_api_key');
    
    // Mock storage get to return empty by default
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() => {
      return Promise.resolve({});
    });
    
    // Mock storage set to succeed
    (chrome.storage.sync.set as jest.Mock).mockImplementation(() => {
      return Promise.resolve();
    });
  });

  test('should initialize correctly', async () => {
    const result = await paymentService.initialize();
    expect(result).toBe(true);
  });

  test('should initialize with existing customer ID', async () => {
    // Mock storage to return customer ID
    (chrome.storage.sync.get as jest.Mock).mockImplementation(() => {
      return Promise.resolve({
        doDoCustomerId: 'existing_customer_id'
      });
    });
    
    await paymentService.initialize();
    expect(paymentService.getCustomerId()).toBe('existing_customer_id');
  });

  test('should create checkout session', async () => {
    await paymentService.initialize();
    const session = await paymentService.createCheckoutSession(testPlan);
    
    expect(session).not.toBeNull();
    expect(session?.id).toBeDefined();
    expect(session?.url).toContain('checkout.dodopayments.com');
  });

  test('should handle payment success', async () => {
    await paymentService.initialize();
    const result = await paymentService.handlePaymentSuccess('test_session_id');
    
    expect(result.success).toBe(true);
    expect(result.subscriptionId).toBeDefined();
    expect(result.customerId).toBeDefined();
    
    // Should save customer ID to storage
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        doDoCustomerId: expect.any(String)
      })
    );
  });

  test('should handle payment failure', async () => {
    await paymentService.initialize();
    const result = await paymentService.handlePaymentFailure('test_session_id', 'payment_failed');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('payment_failed');
  });

  test('should get subscription details', async () => {
    await paymentService.initialize();
    const subscription = await paymentService.getSubscription('test_subscription_id');
    
    expect(subscription).not.toBeNull();
    expect(subscription?.id).toBe('test_subscription_id');
    expect(subscription?.status).toBe('active');
    expect(subscription?.currentPeriodEnd).toBeDefined();
  });

  test('should cancel subscription', async () => {
    await paymentService.initialize();
    const result = await paymentService.cancelSubscription('test_subscription_id');
    
    expect(result).toBe(true);
  });

  test('should update subscription', async () => {
    await paymentService.initialize();
    const result = await paymentService.updateSubscription('test_subscription_id', 'team');
    
    expect(result).toBe(true);
  });
});