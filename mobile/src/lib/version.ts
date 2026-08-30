// Version stamp — shown in the Summary footer, same convention as the PWA.
// APP_VERSION/BUILD change only with a native build; JS_REVISION bumps with
// every OTA (EAS Update) push so Tyler can verify which JS he's running.
export const APP_VERSION = '1.0.0';
export const APP_BUILD = 4;
export const JS_REVISION = 25;

export function versionStamp(): string {
  return `TaxTrail v${APP_VERSION} (build ${APP_BUILD}) · js r${JS_REVISION}`;
}
