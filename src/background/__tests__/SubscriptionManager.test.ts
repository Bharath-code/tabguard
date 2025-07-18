import { SubscriptionManager } from '@/background/SubscriptionManager';
import { StorageManager } from '@/shared/StorageManager';
import { DoDoPaymentService } from '@/background/DoDoPaymentService';

// Mock DoDoPaymentService
jest.mock('@/background/DoDoPaymentService');

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

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager;
  let storageManager: StorageManager;
  let mockPaymentService: jest.Mocked<DoDoPaymentService>;

  beforeEach(() => {
    jest.clearAllMocks();
    storageManager = new StorageManager();
    subscriptionManager = new SubscriptionManager(storageManager);

    // Get the mocked DoDoPaymentService instance
    mockPaymentService = (DoDoPaymentService as unknown as jest.Mock<DoDoPaymentService>).mock.instances[0] as jest.Mocked<DoDoPaymentService>;

    // Setup default mock implementations for payment service
    mockPaymentService.initialize.mockResolvedValue(true);
    mockPaymentService.createCheckoutSession.mockResolvedValue({
      id: 'test_session_id',
      url: 'https://checkout.dodopayments.com/test'
    });
    mockPaymentService.handlePaymentSuccess.mockResolvedValue({
      success: true,
      subscriptionId: 'test_subscription_id',
      customerId: 'test_customer_id'
    });
    mockPaymentService.getSubscription.mockResolvedValue({
      id: 'test_subscription_id',
      customerId: 'test_customer_id',
      planId: 'premium_monthly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    });
    mockPaymentService.cancelSubscription.mockResolvedValue(true);
    mockPaymentService.updateSubscription.mockResolvedValue(true);

    // Mock storage get to return default subscription state
    (chrome.storage.sync.get as jest.Mock).mockImplementation((key) => {
      if (key === 'subscriptionState') {
        return Promise.resolve({
          subscriptionState: {
            plan: 'free',
            expiresAt: null,
            features: {},
            tabLimit: 5
          }
        });
      }
      return Promise.resolve({});
    });
  });

  test('should initialize with free plan by default', async () => {
    await subscriptionManager.initialize();
    const plan = await subscriptionManager.getCurrentPlan();
    expect(plan.id).toBe('free');
    expect(plan.tabLimit).toBe(5);
    expect(plan.aiInsights).toBe(false);
  });

  test('should validate feature access correctly', async () => {
    await subscriptionManager.initialize();

    // Free tier features
    expect(await subscriptionManager.hasFeatureAccess('basic_tab_limit')).toBe(true);
    expect(await subscriptionManager.hasFeatureAccess('notifications')).toBe(true);

    // Premium features
    expect(await subscriptionManager.hasFeatureAccess('unlimited_tabs')).toBe(false);
    expect(await subscriptionManager.hasFeatureAccess('ai_insights')).toBe(false);
    expect(await subscriptionManager.hasFeatureAccess('advanced_rules')).toBe(false);
  });
  
  test('should update feature access after subscription upgrade', async () => {
    await subscriptionManager.initialize();
    
    // Verify premium features are not available initially
    expect(await subscriptionManager.hasFeatureAccess('unlimited_tabs')).toBe(false);
    expect(await subscriptionManager.hasFeatureAccess('ai_insights')).toBe(false);
    
    // Upgrade to premium
    await subscriptionManager.upgradeSubscription('premium');
    
    // Verify premium features are now available
    expect(await subscriptionManager.hasFeatureAccess('unlimited_tabs')).toBe(true);
    expect(await subscriptionManager.hasFeatureAccess('ai_insights')).toBe(true);
    expect(await subscriptionManager.hasFeatureAccess('advanced_rules')).toBe(true);
    
    // Team features should still be unavailable
    expect(await subscriptionManager.hasFeatureAccess('team_management')).toBe(false);
    
    // Upgrade to team
    await subscriptionManager.upgradeSubscription('team');
    
    // Verify team features are now available
    expect(await subscriptionManager.hasFeatureAccess('team_management')).toBe(true);
    expect(await subscriptionManager.hasFeatureAccess('policy_enforcement')).toBe(true);
  });
  
  test('should get available features based on subscription plan', async () => {
    await subscriptionManager.initialize();
    
    // Free tier
    let features = await subscriptionManager.getAvailableFeatures();
    expect(features.length).toBeGreaterThan(0);
    expect(features.some(f => f.id === 'basic_tab_limit')).toBe(true);
    expect(features.some(f => f.id === 'unlimited_tabs')).toBe(false);
    
    // Upgrade to premium
    await subscriptionManager.upgradeSubscription('premium');
    features = await subscriptionManager.getAvailableFeatures();
    
    // Should include premium features
    expect(features.some(f => f.id === 'unlimited_tabs')).toBe(true);
    expect(features.some(f => f.id === 'ai_insights')).toBe(true);
    
    // Should not include team features
    expect(features.some(f => f.id === 'team_management')).toBe(false);
  });

  test('should upgrade subscription plan', async () => {
    await subscriptionManager.initialize();

    // Mock storage set
    (chrome.storage.sync.set as jest.Mock).mockImplementation(() => Promise.resolve());

    // Upgrade to premium
    const result = await subscriptionManager.upgradeSubscription('premium');
    expect(result).toBe(true);

    // Verify storage was updated
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionState: expect.objectContaining({
          plan: 'premium'
        })
      })
    );

    // Check new plan
    const plan = await subscriptionManager.getCurrentPlan();
    expect(plan.id).toBe('premium');
    expect(plan.tabLimit).toBe(100);
    expect(plan.aiInsights).toBe(true);
  });

  test('should get correct tab limit based on subscription', async () => {
    await subscriptionManager.initialize();

    // Free tier
    expect(await subscriptionManager.getTabLimit()).toBe(5);

    // Upgrade to premium
    await subscriptionManager.upgradeSubscription('premium');
    expect(await subscriptionManager.getTabLimit()).toBe(100);

    // Upgrade to team
    await subscriptionManager.upgradeSubscription('team');
    expect(await subscriptionManager.getTabLimit()).toBe(500);
  });

  test('should validate subscription correctly', async () => {
    await subscriptionManager.initialize();

    // Valid subscription
    expect(await subscriptionManager.validateSubscription()).toBe(true);

    // Set expired subscription
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    await subscriptionManager.upgradeSubscription('premium');
    await subscriptionManager.setSubscriptionExpiry(pastDate);

    // Should be invalid now
    expect(await subscriptionManager.validateSubscription()).toBe(false);

    // Should downgrade to free
    const plan = await subscriptionManager.getCurrentPlan();
    expect(plan.id).toBe('free');
  });

  test('should persist subscription state', async () => {
    await subscriptionManager.initialize();
    await subscriptionManager.upgradeSubscription('premium');

    // Create a new instance to test persistence
    const newManager = new SubscriptionManager(storageManager);
    await newManager.initialize();

    const plan = await newManager.getCurrentPlan();
    expect(plan.id).toBe('premium');
  });

  test('should create checkout session', async () => {
    await subscriptionManager.initialize();
    const session = await subscriptionManager.createCheckoutSession('premium');

    expect(session).not.toBeNull();
    expect(mockPaymentService.createCheckoutSession).toHaveBeenCalled();
    expect(session?.id).toBe('test_session_id');
    expect(session?.url).toBe('https://checkout.dodopayments.com/test');
  });

  test('should process payment success', async () => {
    await subscriptionManager.initialize();
    const result = await subscriptionManager.processPaymentSuccess('test_session_id');

    expect(result).toBe(true);
    expect(mockPaymentService.handlePaymentSuccess).toHaveBeenCalledWith('test_session_id');
    expect(mockPaymentService.getSubscription).toHaveBeenCalled();

    // Verify storage was updated with subscription details
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionState: expect.objectContaining({
          plan: 'premium',
          subscriptionId: 'test_subscription_id',
          customerId: 'test_customer_id'
        })
      })
    );
  });

  test('should process payment failure', async () => {
    await subscriptionManager.initialize();
    await subscriptionManager.processPaymentFailure('test_session_id', 'payment_failed');

    expect(mockPaymentService.handlePaymentFailure).toHaveBeenCalledWith('test_session_id', 'payment_failed');
  });

  test('should cancel subscription', async () => {
    // Setup subscription state with active subscription
    (chrome.storage.sync.get as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({
        subscriptionState: {
          plan: 'premium',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          features: {},
          tabLimit: 100,
          subscriptionId: 'test_subscription_id',
          customerId: 'test_customer_id'
        }
      });
    });

    await subscriptionManager.initialize();
    const result = await subscriptionManager.cancelSubscription(true);

    expect(result).toBe(true);
    expect(mockPaymentService.cancelSubscription).toHaveBeenCalledWith('test_subscription_id', true);

    // Verify storage was updated to free plan
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionState: expect.objectContaining({
          plan: 'free',
          tabLimit: 5,
          subscriptionId: undefined
        })
      })
    );
  });

  test('should change subscription plan', async () => {
    // Setup subscription state with active subscription
    (chrome.storage.sync.get as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({
        subscriptionState: {
          plan: 'premium',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          features: {},
          tabLimit: 100,
          subscriptionId: 'test_subscription_id',
          customerId: 'test_customer_id'
        }
      });
    });

    await subscriptionManager.initialize();
    const result = await subscriptionManager.changeSubscriptionPlan('team');

    expect(result).toBe(true);
    expect(mockPaymentService.updateSubscription).toHaveBeenCalledWith('test_subscription_id', 'team');

    // Verify storage was updated to team plan
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionState: expect.objectContaining({
          plan: 'team',
          tabLimit: 500
        })
      })
    );
  });

  test('should check for active subscription', async () => {
    // Setup subscription state with active subscription
    (chrome.storage.sync.get as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({
        subscriptionState: {
          plan: 'premium',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          features: {},
          tabLimit: 100,
          subscriptionId: 'test_subscription_id',
          customerId: 'test_customer_id'
        }
      });
    });

    await subscriptionManager.initialize();
    const hasSubscription = await subscriptionManager.hasActiveSubscription();

    expect(hasSubscription).toBe(true);
  });

  test('should return false for active subscription on free plan', async () => {
    await subscriptionManager.initialize();
    const hasSubscription = await subscriptionManager.hasActiveSubscription();

    expect(hasSubscription).toBe(false);
  });
});