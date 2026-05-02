import { RevenueCatService, ENTITLEMENTS } from '../services/revenueCatService';
import Purchases from 'react-native-purchases';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCustomerInfo(activeEntitlements: Record<string, any> = {}): any {
  return {
    entitlements: {
      active: activeEntitlements,
    },
  };
}

function makeEntitlement(productId: string, expirationDate?: string) {
  return {
    productIdentifier: productId,
    expirationDate: expirationDate ?? null,
  };
}

function mockFetchOk() {
  mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
}

function mockFetchFail() {
  mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Server error' });
}

// ─── Test setup ───────────────────────────────────────────────────────────────

// Export the class for direct instantiation in tests
// (the module exports a singleton, but we need fresh instances per test)
let service: RevenueCatService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new RevenueCatService();
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS = 'test-ios-key';
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8080';
});

// =========================================================================
// parseCustomerInfo (via getSubscriptionInfo)
// =========================================================================

describe('parseCustomerInfo — tier detection', () => {

  beforeEach(() => {
    (service as any).isInitialized = true;
  });

  test('returns PREMIUM when premium entitlement is active', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.PREMIUM]: makeEntitlement('gameiq_premium_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.tier).toBe('PREMIUM');
    expect(result.isActive).toBe(true);
    expect(result.productId).toBe('gameiq_premium_monthly');
  });

  test('returns BASIC when only basic entitlement is active', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.BASIC]: makeEntitlement('gameiq_basic_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.tier).toBe('BASIC');
    expect(result.isActive).toBe(true);
    expect(result.productId).toBe('gameiq_basic_monthly');
  });

  test('returns TRIAL when no entitlements are active', async () => {
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.tier).toBe('TRIAL');
    expect(result.isActive).toBe(false);
  });

  test('PREMIUM takes priority over BASIC when both active', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.PREMIUM]: makeEntitlement('gameiq_premium_monthly'),
      [ENTITLEMENTS.BASIC]:   makeEntitlement('gameiq_basic_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.tier).toBe('PREMIUM');
  });

  test('expirationDate is parsed to Date when present', async () => {
    const expiry = '2026-12-31T00:00:00Z';
    const info = makeCustomerInfo({
      [ENTITLEMENTS.BASIC]: makeEntitlement('gameiq_basic_monthly', expiry),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.expirationDate).toBeInstanceOf(Date);
    expect(result.expirationDate?.toISOString()).toBe(new Date(expiry).toISOString());
  });

  test('expirationDate is undefined when null in entitlement', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.BASIC]: makeEntitlement('gameiq_basic_monthly', undefined),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    const result = await service.getSubscriptionInfo();

    expect(result.expirationDate).toBeUndefined();
  });
});

// =========================================================================
// syncTierIfChanged
// =========================================================================

describe('syncTierIfChanged', () => {

  beforeEach(() => {
    (service as any).isInitialized = true;
  });

  test('does not call backend when tiers match', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.BASIC]: makeEntitlement('gameiq_basic_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);

    await service.syncTierIfChanged(1, 'BASIC');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('calls backend PUT when RevenueCat tier differs from backend tier', async () => {
    // RevenueCat says TRIAL (subscription expired), backend still shows BASIC
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchOk();

    await service.syncTierIfChanged(1, 'BASIC');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/1/subscription'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ subscriptionTier: 'TRIAL' }),
      })
    );
  });

  test('syncs PREMIUM to TRIAL when subscription expires', async () => {
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchOk();

    await service.syncTierIfChanged(42, 'PREMIUM');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.subscriptionTier).toBe('TRIAL');
  });

  test('syncs TRIAL to BASIC when subscription activates', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.BASIC]: makeEntitlement('gameiq_basic_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchOk();

    await service.syncTierIfChanged(1, 'TRIAL');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.subscriptionTier).toBe('BASIC');
  });

  test('syncs BASIC to PREMIUM on upgrade', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.PREMIUM]: makeEntitlement('gameiq_premium_monthly'),
    });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchOk();

    await service.syncTierIfChanged(1, 'BASIC');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.subscriptionTier).toBe('PREMIUM');
  });

  test('does not throw when backend returns error response', async () => {
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchFail();

    await expect(service.syncTierIfChanged(1, 'BASIC')).resolves.not.toThrow();
  });

  test('does not throw when fetch throws a network error', async () => {
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(service.syncTierIfChanged(1, 'BASIC')).resolves.not.toThrow();
  });

  test('does not throw when getCustomerInfo throws', async () => {
    (Purchases.getCustomerInfo as jest.Mock).mockRejectedValueOnce(new Error('RC error'));

    await expect(service.syncTierIfChanged(1, 'BASIC')).resolves.not.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('uses correct userId in PUT URL', async () => {
    const info = makeCustomerInfo({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(info);
    mockFetchOk();

    await service.syncTierIfChanged(99, 'PREMIUM');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/99/subscription'),
      expect.anything()
    );
  });
});

// =========================================================================
// purchaseSubscription — error mapping
// =========================================================================

describe('purchaseSubscription error handling', () => {

  beforeEach(() => {
    (service as any).isInitialized = true;
  });

  test('maps PURCHASE_CANCELLED code to readable message', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({ code: 'PURCHASE_CANCELLED' });

    await expect(service.purchaseSubscription({} as any))
      .rejects.toThrow('Purchase was cancelled');
  });

  test('maps PAYMENT_PENDING code to readable message', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({ code: 'PAYMENT_PENDING' });

    await expect(service.purchaseSubscription({} as any))
      .rejects.toThrow('Payment is pending approval');
  });

  test('maps PRODUCT_NOT_AVAILABLE code to readable message', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({ code: 'PRODUCT_NOT_AVAILABLE' });

    await expect(service.purchaseSubscription({} as any))
      .rejects.toThrow('Product not available');
  });

  test('wraps unknown errors with Purchase failed prefix', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({ message: 'Something went wrong' });

    await expect(service.purchaseSubscription({} as any))
      .rejects.toThrow('Purchase failed: Something went wrong');
  });

  test('returns parsed subscription info on success', async () => {
    const info = makeCustomerInfo({
      [ENTITLEMENTS.PREMIUM]: makeEntitlement('gameiq_premium_monthly'),
    });
    (Purchases.purchasePackage as jest.Mock).mockResolvedValueOnce({ customerInfo: info });

    const result = await service.purchaseSubscription({} as any);

    expect(result.tier).toBe('PREMIUM');
    expect(result.isActive).toBe(true);
  });
});

// =========================================================================
// getSubscriptionInfo — not initialized guard
// =========================================================================

describe('not initialized guard', () => {

  test('getSubscriptionInfo throws when not initialized', async () => {
    (service as any).isInitialized = false;

    await expect(service.getSubscriptionInfo()).rejects.toThrow('RevenueCat not initialized');
  });

  test('purchaseSubscription throws when not initialized', async () => {
    (service as any).isInitialized = false;

    await expect(service.purchaseSubscription({} as any)).rejects.toThrow('RevenueCat not initialized');
  });
});