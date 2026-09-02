/*
 * The Face ID app lock: preference, availability, and the prompt itself.
 *
 * The decision rules ("is it locked right now") are in `appLock.js`, pure and
 * unit-tested. This file is the part that needs the device.
 *
 * `expo-local-authentication` is imported statically on purpose. It is compiled
 * into every live binary (builds 3, 4, 5 and 6 all carry it), so this is not the
 * D-062 hazard a static import usually is, and `npm run test:ota` proves it on
 * every PR. It was compiled in for a feature that did not exist, which is half
 * of D-066; this is the feature.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Namespaced like the other stored keys (see memory.ts). Absent means ON: the
// default is on (Tyler's call, D-079), and an absent key is a user who has
// never touched the setting.
const KEY = 'rs.appLock.v1';

export async function isLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== '0';
  } catch {
    // An unreadable preference falls back to the default rather than to "off":
    // failing open would silently disable a privacy feature.
    return true;
  }
}

export async function setLockEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Nothing useful to do. The toggle already moved on screen.
  }
}

/**
 * Can this device unlock at all?
 *
 * `getEnrolledLevelAsync`, not `isEnrolledAsync`: the prompt allows the device
 * passcode as a fallback, so a phone with a passcode and no biometrics can
 * still get in. `NONE` means neither, and locking there would leave the owner
 * with no way into their own receipts.
 */
export async function isLockAvailable(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** True if the user got in. A cancel is a false, not an error. */
export async function authenticate(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock TaxTrail',
      cancelLabel: 'Cancel',
      // Device passcode stays available. Without it, a failed or unrecognised
      // face is the end of the road, and a receipt archive is not something to
      // lock someone out of.
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    return false;
  }
}
