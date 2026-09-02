/*
 * Light, dark, or follow the phone.
 *
 * This overturns a decision. `useTheme` used to say: "Follows the OS rather
 * than offering an in-app switch. iOS already has that setting, it is where
 * people look for it." That reasoning holds for an app you dip into. It does
 * not hold for one you use at a restaurant table in the evening and at a desk
 * in the morning, which is what Tyler asked for (D-077).
 *
 * Two things happen when the choice changes:
 *
 *  1. `useTheme()` returns the matching palette, which is what repaints the app.
 *  2. `Appearance.setColorScheme()` sets `window.overrideUserInterfaceStyle`,
 *     which is what makes the SYSTEM surfaces match: alerts, the keyboard, the
 *     share sheet, the RevenueCat paywall. Without it a light-mode app raises
 *     black alert dialogs, which reads as a bug.
 *
 * **"System" is dark until build 7.** `app.json` sets
 * `userInterfaceStyle: "dark"`, which pins the window's trait collection, so
 * `useColorScheme()` returns 'dark' on a phone set to Light. The value is
 * changed to "automatic" in the same commit as this file, and it takes a native
 * build to reach a binary.
 *
 * **Light and Dark on build 6 are expected to work, and are NOT verified.**
 * `RCTAppearance.mm` sets `window.overrideUserInterfaceStyle`, and a window
 * override is documented to win over the app-level `UIUserInterfaceStyle`, so
 * the reasoning is sound. But how UIKit resolves that pair is not something
 * this environment can run, and CLAUDE.md is explicit that reasoning is not
 * verification. Tyler can settle it in five seconds by tapping Light.
 */
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeChoice = 'system' | 'light' | 'dark';

// Namespaced like the other stored keys (see memory.ts).
const KEY = 'rs.theme.v1';

const CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

/*
 * Module state rather than context: `useTheme()` is called by every screen and
 * several components, and threading a provider through all of them buys nothing
 * that a subscription does not. `useSyncExternalStore` is the sanctioned way to
 * read mutable module state without tearing.
 */
let choice: ThemeChoice = 'system';
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function apply(next: ThemeChoice): void {
  try {
    // 'unspecified' clears the override and hands control back to the trait
    // collection, which is the system setting once the plist stops pinning it.
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  } catch {
    // Older binary, or no window yet. The palette still switches; only the
    // system surfaces stay as they were, which is worth no crash at all.
  }
}

export function getThemeChoice(): ThemeChoice {
  return choice;
}

/** Read the stored choice. Call once at startup, before the first paint. */
export async function loadThemeChoice(): Promise<ThemeChoice> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored && (CHOICES as string[]).includes(stored)) choice = stored as ThemeChoice;
  } catch {
    // An unreadable preference is not worth a failed launch. 'system' stands.
  }
  apply(choice);
  emit();
  return choice;
}

export async function setThemeChoice(next: ThemeChoice): Promise<void> {
  if (!(CHOICES as string[]).includes(next)) return;
  choice = next;
  apply(next);
  emit();
  try {
    await AsyncStorage.setItem(KEY, next);
  } catch {
    // The app is already showing the new theme; it just will not remember it.
  }
}

/** Subscribe a component to the choice. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getThemeChoice, getThemeChoice);
}
