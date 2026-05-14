import { Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import ENV_CONFIG from '../config/environment';

// Set to true for local testing when subscriptions aren't approved yet
const DEV_MODE = false;

export const SUBSCRIPTION_PRODUCTS = {
  BASIC_MONTHLY:   'wellnessiq_basic_v2',
  PREMIUM_MONTHLY: 'wellnessiq_premium_v2',
};

export const ENTITLEMENTS = {
  BASIC:   'wellnessiq_basic_v2',
  PREMIUM: 'wellnessiq_premium_v2',
};

export interface SubscriptionInfo {
  isActive: boolean;
  tier: 'BASIC' | 'PREMIUM' | 'TRIAL';
  productId?: string;
  expirationDate?: Date;
}

const API_BASE = ENV_CONFIG.BACKEND_URL;

export class RevenueCatService {
  private isInitialized = false;

  async initialize(userId: string): Promise {
    try {
      const apiKey = Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
        : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) throw new Error('RevenueCat API key not found in environment variables');

      await Purchases.configure({ apiKey });
      await Purchases.logIn(userId);
      this.isInitialized = true;
      console.log('RevenueCat initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  async getSubscriptionInfo(): Promise {
    if (!this.isInitialized) throw new Error('RevenueCat not initialized');
    const customerInfo = await Purchases.getCustomerInfo();
    return this.parseCustomerInfo(customerInfo);
  }

  async getAvailablePackages(): Promise {
    if (!this.isInitialized) throw new Error('RevenueCat not initialized');
    
    // Dev mode: return mock packages for testing
    if (DEV_MODE) {
      console.log('DEV_MODE: Returning mock packages');
      return this.getMockPackages();
    }

    try {
      const offerings = await Purchases.getOfferings();
      const packages: PurchasesPackage[] = [];

      // Get packages from the 'default' offering
      const defaultOffering = offerings.all['default'];
      if (defaultOffering) {
        packages.push(...defaultOffering.availablePackages);
      }

      console.log('Available packages:', packages.map(p => p.product.identifier));
      return packages;
    } catch (error) {
      console.error('Error getting packages:', error);
      return [];
    }
  }

  private getMockPackages(): PurchasesPackage[] {
    // Mock packages for local testing
    return [
      {
        identifier: 'monthly_basic',
        packageType: 'MONTHLY',
        product: {
          identifier: SUBSCRIPTION_PRODUCTS.BASIC_MONTHLY,
          description: 'WellnessIQ Basic',
          title: 'WellnessIQ Basic - Monthly',
          price: 12.99,
          priceString: '$12.99',
          currencyCode: 'USD',
          introductoryPrice: null,
          discounts: [],
          isFamilyShareable: false,
          subscriptionPeriod: '1 month',
        },
        offeringIdentifier: 'default',
      } as any,
      {
        identifier: 'monthly_premium',
        packageType: 'MONTHLY',
        product: {
          identifier: SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY,
          description: 'WellnessIQ Premium',
          title: 'WellnessIQ Premium - Monthly',
          price: 19.99,
          priceString: '$19.99',
          currencyCode: 'USD',
          introductoryPrice: null,
          discounts: [],
          isFamilyShareable: false,
          subscriptionPeriod: '1 month',
        },
        offeringIdentifier: 'default',
      } as any,
    ];
  }

  async purchaseSubscription(packageToPurchase: PurchasesPackage): Promise {
    if (!this.isInitialized) throw new Error('RevenueCat not initialized');
    
    if (DEV_MODE) {
      console.log('DEV_MODE: Simulating purchase for', packageToPurchase.product.identifier);
      // In dev mode, simulate a successful purchase
      return {
        isActive: true,
        tier: packageToPurchase.product.identifier.includes('premium') ? 'PREMIUM' : 'BASIC',
        productId: packageToPurchase.product.identifier,
      };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return this.parseCustomerInfo(customerInfo);
    } catch (error: any) {
      if (error?.code === 'PURCHASE_CANCELLED') throw new Error('Purchase was cancelled');
      if (error?.code === 'PAYMENT_PENDING')    throw new Error('Payment is pending approval');
      if (error?.code === 'PRODUCT_NOT_AVAILABLE') throw new Error('Product not available');
      throw new Error(`Purchase failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async restorePurchases(): Promise {
    if (!this.isInitialized) throw new Error('RevenueCat not initialized');
    const customerInfo = await Purchases.restorePurchases();
    return this.parseCustomerInfo(customerInfo);
  }

  /**
   * Called on app launch after initialization.
   * Compares the current RevenueCat entitlement against the backend tier
   * and syncs if they differ — handles cancellations, expirations, and renewals
   * without needing a webhook.
   */
  async syncTierIfChanged(backendUserId: number, backendTier: string): Promise {
    try {
      const info = await this.getSubscriptionInfo();
      const revenueCatTier = info.tier; // 'BASIC' | 'PREMIUM' | 'TRIAL'

      if (revenueCatTier === backendTier) {
        console.log('Subscription tier in sync:', revenueCatTier);
        return;
      }

      console.log(`Tier mismatch — RevenueCat: ${revenueCatTier}, backend: ${backendTier}. Syncing...`);

      const res = await fetch(`${API_BASE}/api/v1/users/${backendUserId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionTier: revenueCatTier }),
      });

      if (!res.ok) {
        console.error('Failed to sync tier to backend:', await res.text());
      } else {
        console.log('Tier synced successfully to:', revenueCatTier);
      }
    } catch (error) {
      // Non-fatal — log and move on. The app still works, sync will retry next launch.
      console.error('Error during tier sync:', error);
    }
  }

  // ─── Use entitlements (not product ID string matching) ────────────────────
  private parseCustomerInfo(customerInfo: CustomerInfo): SubscriptionInfo {
    const active = customerInfo.entitlements.active;

    if (active[ENTITLEMENTS.PREMIUM]) {
      const ent = active[ENTITLEMENTS.PREMIUM];
      return {
        isActive: true,
        tier: 'PREMIUM',
        productId: ent.productIdentifier,
        expirationDate: ent.expirationDate ? new Date(ent.expirationDate) : undefined,
      };
    }

    if (active[ENTITLEMENTS.BASIC]) {
      const ent = active[ENTITLEMENTS.BASIC];
      return {
        isActive: true,
        tier: 'BASIC',
        productId: ent.productIdentifier,
        expirationDate: ent.expirationDate ? new Date(ent.expirationDate) : undefined,
      };
    }

    return { isActive: false, tier: 'TRIAL' };
  }
}

export const revenueCatService = new RevenueCatService();