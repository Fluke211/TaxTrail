// RevenueCat wiring. Everything here is defensive: with the placeholder API key
// (or offline), the app runs in free mode and purchase UI is unavailable —
// no crashes, no blocked flows.
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_PRO, REVENUECAT_APPLE_API_KEY } from './config';

let configured = false;

export function initPurchases(): void {
  if (configured) return;
  if (!REVENUECAT_APPLE_API_KEY || REVENUECAT_APPLE_API_KEY.includes('REPLACE_ME')) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_APPLE_API_KEY });
    configured = true;
  } catch (e) {
    console.warn('RevenueCat configure failed', e);
  }
}

export async function isPro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PRO] != null;
  } catch {
    return false;
  }
}

// Show the RevenueCat remote-configured paywall; falls back to a plain package
// chooser if no paywall template is configured in the dashboard yet.
export async function presentPaywall(): Promise<boolean> {
  if (!configured) {
    Alert.alert(
      'Purchases not configured',
      'Set REVENUECAT_APPLE_API_KEY in src/lib/config.ts to enable ReceiptSnap Pro.'
    );
    return false;
  }
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_PRO,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED; // NOT_PRESENTED = already entitled
  } catch {
    // No paywall configured in the dashboard — plain fallback purchase flow.
    try {
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      if (!pkgs.length) {
        Alert.alert('Store unavailable', 'Could not load products. Check the RevenueCat offering configuration.');
        return false;
      }
      return await new Promise<boolean>((resolve) => {
        Alert.alert(
          'ReceiptSnap Pro',
          'Unlimited scans + all export formats.',
          [
            ...pkgs.map((p) => ({
              text: `${p.product.title} — ${p.product.priceString}`,
              onPress: async () => {
                try {
                  const { customerInfo } = await Purchases.purchasePackage(p);
                  resolve(customerInfo.entitlements.active[ENTITLEMENT_PRO] != null);
                } catch { resolve(false); }
              },
            })),
            { text: 'Restore purchases', onPress: async () => {
              try {
                const info = await Purchases.restorePurchases();
                resolve(info.entitlements.active[ENTITLEMENT_PRO] != null);
              } catch { resolve(false); }
            } },
            { text: 'Not now', style: 'cancel' as const, onPress: () => resolve(false) },
          ]
        );
      });
    } catch (e) {
      console.warn('purchase flow failed', e);
      return false;
    }
  }
}
