// TaxTrail theme. Dark palette unchanged (same tokens as the retired PWA);
// light palette added alongside it, chosen by the system setting.
//
// `T` is still exported as the dark palette so nothing that has not been
// converted breaks. Screens that follow the system setting call `useTheme()`
// and build their StyleSheet from the palette it returns — StyleSheet.create
// runs once at module load, so a themed screen cannot keep its styles at module
// scope. See `styled()` below.
import { StyleSheet, useColorScheme } from 'react-native';

export interface Palette {
  accent: string;
  accentSoft: string;
  accentLine: string;
  bg: string;
  bg2: string;
  card: string;
  card2: string;
  line: string;
  text: string;
  muted: string;
  muted2: string;
  danger: string;
  /** A danger-tinted hairline. Was hardcoded as the dark red in two places,
   *  which stayed pink on a white card until light mode made it visible. */
  dangerLine: string;
  warn: string;
  good: string;
  radius: number;
  radiusLg: number;
  /** For `<StatusBar style>` and anywhere the mode itself matters. */
  scheme: 'light' | 'dark';
}

export const DARK: Palette = {
  accent: '#4f7cff',
  accentSoft: 'rgba(79,124,255,0.16)',
  accentLine: 'rgba(79,124,255,0.40)',
  bg: '#0a0e14',
  bg2: '#0d1420',
  card: '#121a26',
  card2: '#182333',
  line: 'rgba(255,255,255,0.07)',
  text: '#e8edf5',
  muted: '#8a97ab',
  muted2: '#5b6678',
  danger: '#ff6b6b',
  dangerLine: 'rgba(255,107,107,0.40)',
  warn: '#f0b429',
  good: '#35c88a',
  radius: 14,
  radiusLg: 20,
  scheme: 'dark',
};

/*
 * Light palette.
 *
 * Not the dark one inverted. Two things had to change beyond lightness:
 *
 * - `accent` darkens from #4f7cff to #2f5ae0. The original is fine on a near
 *   black ground and fails against white — it is the colour of every clickable
 *   thing in the app, so it is the one token that has to be readable.
 * - `danger`, `warn` and `good` darken for the same reason. #ff6b6b on white is
 *   a pale pink; on the Delete control in the danger zone, "unreadable" and
 *   "destructive" is a bad pairing.
 *
 * `line` becomes a black alpha rather than a white one — a white hairline on a
 * white card is invisible, which would have silently removed every border in
 * the app.
 */
export const LIGHT: Palette = {
  accent: '#2f5ae0',
  accentSoft: 'rgba(47,90,224,0.10)',
  accentLine: 'rgba(47,90,224,0.35)',
  bg: '#f6f7f9',
  bg2: '#ffffff',
  card: '#ffffff',
  card2: '#f1f3f7',
  line: 'rgba(16,24,40,0.10)',
  text: '#131924',
  muted: '#5a6577',
  muted2: '#7f899c',
  danger: '#d13b3b',
  dangerLine: 'rgba(209,59,59,0.35)',
  warn: '#a86a00',
  good: '#1c8c5e',
  radius: 14,
  radiusLg: 20,
  scheme: 'light',
};

/** Back-compat: the dark palette, as `T` has always been. */
export const T = DARK;

/**
 * The palette for the current system appearance.
 *
 * Follows the OS rather than offering an in-app switch. iOS already has that
 * setting, it is where people look for it, and an app-level override is one more
 * thing to keep in sync with no benefit — Settings has enough in it already.
 * `useColorScheme` returns null before the value is known; dark is the safer
 * default, because it is what every existing screenshot and the current binary
 * look like.
 */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? LIGHT : DARK;
}

/**
 * Build a themed stylesheet, memoised per palette.
 *
 * Usage:
 *   const makeStyles = styled((T) => ({ card: { backgroundColor: T.card } }));
 *   // inside the component:
 *   const T = useTheme();
 *   const s = makeStyles(T);
 *
 * The cache is keyed on the palette object, and there are exactly two of those,
 * so a screen builds its styles at most twice for the life of the process
 * rather than on every render.
 */
export function styled<S extends StyleSheet.NamedStyles<S>>(
  build: (t: Palette) => S,
): (t: Palette) => S {
  const cache = new Map<Palette, S>();
  return (t: Palette) => {
    let s = cache.get(t);
    if (!s) { s = StyleSheet.create(build(t)); cache.set(t, s); }
    return s;
  };
}
