// TaxTrail theme. Dark palette unchanged (same tokens as the retired PWA);
// light palette added alongside it, chosen by the system setting.
//
// `T` is still exported as the dark palette so nothing that has not been
// converted breaks. Screens that follow the system setting call `useTheme()`
// and build their StyleSheet from the palette it returns — StyleSheet.create
// runs once at module load, so a themed screen cannot keep its styles at module
// scope. See `styled()` below.
import { StyleSheet, useColorScheme } from 'react-native';
import { useThemeChoice } from './appearance';

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
  /**
   * Type scale for everything below a heading.
   *
   * One knob, because "still a bit small" is feedback that arrives more than
   * once and used to mean editing 58 hardcoded sizes across 10 files. Headings,
   * amounts and the brand mark keep their own sizes: they were tuned
   * individually and none of them was ever the complaint.
   *
   * `readonly`, and the object is frozen: both palettes share one instance, so
   * a write through `T.fs` would change the other palette too, and `styled()`
   * memoises per palette, so the stylesheets would keep serving the old size
   * and the mutation would look like it did nothing.
   */
  readonly fs: {
    readonly xs: number; readonly sm: number; readonly md: number;
    readonly body: number; readonly lg: number;
  };
  /**
   * Leading, one entry per size.
   *
   * In the scale rather than hardcoded next to it, because D-080's whole point
   * is that the next size bump is one number. Eight literal line heights would
   * have quietly re-tightened every paragraph the moment TYPE moved.
   */
  readonly lh: {
    readonly xs: number; readonly sm: number; readonly md: number;
    readonly body: number; readonly lg: number;
  };
  /** For `<StatusBar style>` and anywhere the mode itself matters. */
  scheme: 'light' | 'dark';
}

/*
 * Raised 2026-09-03 (D-080), Tyler's second pass: the small end was not
 * comfortable to read. Every step went up by 1 to 2 points, which for the
 * smallest labels is a 20% increase.
 *
 *   xs    10, 10.5, 11    ->  12   overlines, tab labels, badges
 *   sm    11.5, 12        ->  13   notes, hints, list metadata
 *   md    12.5, 13        ->  14   secondary body
 *   body  13.5, 14        ->  15   rows, controls, form labels
 *
 * The same numbers in both palettes: this is legibility, not colour.
 */
const TYPE = Object.freeze({ xs: 12, sm: 13, md: 14, body: 15, lg: 16 } as const);

/** 1.4x, rounded to a whole point. Comfortable for a paragraph, not airy. */
const LEADING = Object.freeze({ xs: 17, sm: 18, md: 20, body: 21, lg: 22 } as const);

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
  /*
   * Brightened twice, both times because Tyler read the app in low light and
   * said it was hard going (D-078, then D-080).
   *
   *            original   first pass   now      on the app background
   *   muted    #8a97ab    #9aa6b8      #b3bcca  6.5 -> 7.9 -> 10.1
   *   muted2   #5b6678    #78849a      #98a3b5  3.3 -> 5.1 -> 7.6
   *
   * The hierarchy is what to watch when brightening secondary text, and it
   * holds: `text` is 16.5, `muted` 10.1, `muted2` 7.6. Three steps, each
   * visibly dimmer than the one above it.
   */
  muted: '#b3bcca',
  muted2: '#98a3b5',
  danger: '#ff6b6b',
  dangerLine: 'rgba(255,107,107,0.40)',
  warn: '#f0b429',
  good: '#35c88a',
  radius: 14,
  radiusLg: 20,
  fs: TYPE,
  lh: LEADING,
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
  /*
   * Darkened 2026-09-03 alongside the dark brightening (D-080).
   *
   * `muted2` was 3.3:1 on the app background, which is WCAG's threshold for
   * large text and non-text. It renders at 12 and 13 points, where the bar is
   * 4.5, so it was below AA everywhere it appeared. That was survivable while
   * light mode was unreachable; it became reachable in r31 and Tyler uses it.
   *
   *   muted   #5a6577 -> #4b5566   5.5 -> 7.0 on the background
   *   muted2  #7f899c -> #636e80   3.3 -> 4.8
   */
  muted: '#4b5566',
  muted2: '#636e80',
  danger: '#d13b3b',
  dangerLine: 'rgba(209,59,59,0.35)',
  warn: '#a86a00',
  good: '#1c8c5e',
  radius: 14,
  radiusLg: 20,
  fs: TYPE,
  lh: LEADING,
  scheme: 'light',
};

/** Back-compat: the dark palette, as `T` has always been. */
export const T = DARK;

/**
 * The palette for the current appearance.
 *
 * This used to follow the OS with no in-app switch, on the reasoning that iOS
 * already has that setting and it is where people look for it. Tyler asked for
 * the switch, and he is right about why: an app used at a restaurant table in
 * the evening and at a desk in the morning wants its own control (D-077).
 *
 * `useColorScheme` returns null before the value is known; dark is the safer
 * default, because it is what every existing screenshot and the current binary
 * look like.
 */
export function useTheme(): Palette {
  const choice = useThemeChoice();
  const scheme = useColorScheme();
  if (choice === 'light') return LIGHT;
  if (choice === 'dark') return DARK;
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
