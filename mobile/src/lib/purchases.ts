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

/**
 * Open the App Store's own manage-subscriptions sheet.
 *
 * Apple gives no other way to cancel a subscription bought through TestFlight
 * with a real Apple Account: Settings -> Subscriptions does not list it, and
 * App Store Connect's "Clear Purchase History" only works on sandbox testers.
 * Without this the only exit is waiting out the six accelerated renewals.
 *
 * It is also the right thing for shipping. A subscriber who cannot find how to
 * cancel does not decide to keep paying; they ask for a refund and leave a
 * one-star review on the way out.
 */
export async function manageSubscription(): Promise<void> {
  if (!configured) {
    Alert.alert('Purchases not configured', 'TaxTrail Pro is unavailable in this build.');
    return;
  }
  try {
    await Purchases.showManageSubscriptions();
  } catch (e) {
    // iOS < 13 throws, and the sheet can fail to present if the account has
    // nothing to manage. Neither is worth a crash or a silent no-op.
    Alert.alert(
      'Could not open subscription settings',
      'Manage your subscription in Settings > Apple Account > Subscriptions.'
    );
    console.warn('showManageSubscriptions failed', e);
  }
}

/**
 * Restore a purchase made on another device, or before a reinstall.
 *
 * Apple **requires** a restore control for any app selling a non-consumable or
 * subscription (Guideline 3.1.1), and until now the only one lived inside the
 * fallback paywall — which is shown only when RevenueCat's remote template
 * fails to load. In the normal case there was no restore button anywhere, which
 * is a review rejection as much as a user problem: somebody who paid for
 * lifetime Pro and got a new phone had no way to prove it.
 *
 * Returns whether Pro is active afterwards, and says so either way. Silence
 * after tapping Restore is indistinguishable from a broken button.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!configured) {
    Alert.alert('Purchases not configured', 'TaxTrail Pro is unavailable in this build.');
    return false;
  }
  try {
    const info = await Purchases.restorePurchases();
    const pro = info.entitlements.active[ENTITLEMENT_PRO] != null;
    Alert.alert(
      pro ? 'Purchases restored' : 'Nothing to restore',
      pro
        ? 'TaxTrail Pro is active on this device.'
        : 'No previous purchase was found for this Apple Account. If you bought Pro '
          + 'with a different Apple Account, sign in with that one and try again.',
    );
    return pro;
  } catch (e) {
    console.warn('restorePurchases failed', e);
    Alert.alert('Could not restore', 'Check your connection and try again.');
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
