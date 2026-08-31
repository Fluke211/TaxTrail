/*
 * Ionicons, with a fallback for binaries where the font never loads.
 *
 * `@expo/vector-icons` imports `expo-font`, which calls
 * requireNativeModule('ExpoFontLoader') at module scope. Builds 4 and 5 compiled
 * expo-font 57.0.1 against expo-modules-core 55 — npm hoisted the wrong major
 * because `@expo/vector-icons` peer-depends on `expo-font >=14.0.4` while `expo`
 * pins `~55.0.8` — and that module never registers at runtime. The throw
 * happened while the module graph was still evaluating, so it took the whole app
 * down before anything rendered (D-072).
 *
 * The real fix is the npm `overrides` entry, and it needs a native build. This
 * is what keeps the app usable until that build lands, and it is deliberately
 * written so it needs no follow-up: the moment a binary has a working
 * ExpoFontLoader, the require succeeds and real icons come back on their own.
 * Nothing to remember, nothing to revert.
 *
 * Guarded require rather than a static import, for the same reason
 * isRestoreAvailable() in exportShare.ts uses one: a static import is hoisted
 * and would throw before the try block exists.
 */
import React from 'react';
import { Text } from 'react-native';

function loadIonicons(): any | null {
  try {
    const m = require('@expo/vector-icons/Ionicons');
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}

const Ionicons = loadIonicons();

/** True when real icons are available. Exported so a screen can check rather than guess. */
export const iconsAvailable = Ionicons != null;

/*
 * Text stand-ins, chosen to stay legible at tab-bar size and to keep the
 * filled/outline distinction the tab bar relies on to show the active tab.
 */
const GLYPH: Record<string, string> = {
  camera: '◉', 'camera-outline': '○',
  receipt: '■', 'receipt-outline': '□',
  'stats-chart': '▰', 'stats-chart-outline': '▱',
  settings: '⚙', 'settings-outline': '⚙',
  'scan-outline': '⬚',
  'information-circle-outline': 'ⓘ',
  checkbox: '☑', 'square-outline': '☐',
};

export default function Icon(
  { name, size = 20, color }: { name: string; size?: number; color?: string },
) {
  if (Ionicons) return <Ionicons name={name as any} size={size} color={color} />;
  return (
    <Text
      allowFontScaling={false}
      style={{ fontSize: size, lineHeight: size * 1.15, color, textAlign: 'center' }}
    >
      {GLYPH[name] ?? '•'}
    </Text>
  );
}
