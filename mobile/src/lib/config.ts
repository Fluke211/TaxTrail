// App configuration — every value here is JS-only, so it can be changed later
// via an EAS OTA update without a new native build.

// RevenueCat PUBLIC Apple API key. Paste yours from
// app.revenuecat.com → Project → API keys (starts with "appl_").
// Leaving the placeholder keeps the app fully functional in free mode:
// purchases are simply disabled until the key is set.
export const REVENUECAT_APPLE_API_KEY = 'appl_REPLACE_ME';

// Entitlement / product identifiers (must match the RevenueCat dashboard).
export const ENTITLEMENT_PRO = 'pro';

// Free-tier limit: scans per calendar month.
export const FREE_SCANS_PER_MONTH = 10;

// Display-only fallback pricing (real prices always come from StoreKit at runtime).
export const DISPLAY_PRICES = {
  monthly: '$6.99/mo',
  annual: '$39.99/yr',
  lifetime: '$99.99 once',
};
