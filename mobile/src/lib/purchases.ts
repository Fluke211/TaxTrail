// RevenueCat wiring. Everything here is defensive: with the placeholder API key
// (or offline), the app runs in free mode and purchase UI is unavailable —
// no crashes, no blocked flows.
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_PRO, REVENUECAT_APPLE_API_KEY } from './config';
import type { PaywallPackage } from '../components/FallbackPaywall';

let configured = false;

// The fallback paywall must be a real screen with the disclosures Apple requires
// (Guideline 3.1.2), which an Alert cannot carry. This module can't render, so
// App.tsx registers a presenter and we call into it.
type FallbackPresenter = (
  packages: PaywallPackage[],
  onChoice: (id: string | 'restore' | 'cancel') => void,
) => void;

let presentFallback: FallbackPresenter | null = null;

export function registerFallbackPaywall(fn: FallbackPresenter | null): void {
  presentFallback = fn;
}

function periodLabelFor(p: any): { periodLabel: string; autoRenewing: boolean; introLabel?: string } {
  const period: string | undefined = p.product?.subscriptionPeriod;   // ISO 8601, e.g. P1M / P1Y
  if (!period) return { periodLabel: 'one-time purchase', autoRenewing: false };
  const label = period === 'P1M' ? 'per month'
    : period === 'P1Y' ? 'per year'
    : period === 'P1W' ? 'per week'
    : `per ${period.replace('P', '').toLowerCase()}`;
  const intro = p.product?.introPrice;
  const introLabel = intro && intro.price === 0
    ? `${intro.periodNumberOfUnits}-${String(intro.periodUnit || '').toLowerCase()} free trial, then`
    : undefined;
  return { periodLabel: label, autoRenewing: true, introLabel };
}

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
      'Set REVENUECAT_APPLE_API_KEY in src/lib/config.ts to enable TaxTrail Pro.'
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
      if (!presentFallback) {
        // Refuse to offer a purchase through a non-compliant surface.
        Alert.alert('Store unavailable', 'Could not open the purchase screen. Please try again.');
        return false;
      }
      const described: PaywallPackage[] = pkgs.map((p) => {
        const meta = periodLabelFor(p);
        return {
          id: p.identifier,
          title: p.product.title,
          priceString: p.product.priceString,
          periodLabel: meta.periodLabel,
          introLabel: meta.introLabel,
          autoRenewing: meta.autoRenewing,
        };
      });
      return await new Promise<boolean>((resolve) => {
        presentFallback!(described, async (choice) => {
          if (choice === 'cancel') return resolve(false);
          if (choice === 'restore') {
            try {
              const info = await Purchases.restorePurchases();
              return resolve(info.entitlements.active[ENTITLEMENT_PRO] != null);
            } catch { return resolve(false); }
          }
          const pkg = pkgs.find((p) => p.identifier === choice);
          if (!pkg) return resolve(false);
          try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            resolve(customerInfo.entitlements.active[ENTITLEMENT_PRO] != null);
          } catch { resolve(false); }
        });
      });
    } catch (e) {
      console.warn('purchase flow failed', e);
      return false;
    }
  }
}
