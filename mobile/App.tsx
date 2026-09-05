// TaxTrail — root component. Custom four-tab shell (no navigation library:
// fewer native deps = safer single EAS build).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './src/components/Icon';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DARK, styled, useTheme } from './src/lib/theme';
import { loadThemeChoice } from './src/lib/appearance';
import { authenticate, primeLock, readLock, subscribeLock } from './src/lib/appLockNative';
import { LockScreen } from './src/components/LockScreen';
import { allReceipts, type Receipt } from './src/lib/db';
import { initPurchases, isPro, registerFallbackPaywall } from './src/lib/purchases';
import { FallbackPaywall, type PaywallPackage } from './src/components/FallbackPaywall';
// Typed through appLock.d.ts, so a mistyped option is a compile error rather
// than an undefined that silently locks the app on every foreground.
const AL: typeof import('./src/lib/appLock') = require('./src/lib/appLock.js');
import CaptureScreen from './src/screens/CaptureScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type Tab = 'capture' | 'receipts' | 'summary' | 'settings';

/*
 * The Face ID gate (D-079).
 *
 * The state machine is `appLock.js`'s reducer, so every transition is a
 * fixture rather than something verified by unlocking a phone. This hook is
 * only the wiring: read the preference, feed AppState in, run the prompt.
 *
 * Two things it must get right, both found by review rather than by testing:
 *
 *  - The lock decision on resume is SYNCHRONOUS, from values already in hand.
 *    Awaiting AsyncStorage first meant the receipt list painted for a few
 *    frames before the lock screen, which is the leak the feature exists to
 *    prevent. The async re-read still happens, to catch a preference the
 *    Settings screen changed, but it refines a decision rather than making it.
 *  - The preference is subscribed to, not sampled once. Turning the lock back
 *    on and immediately swiping to the app switcher used to photograph the
 *    receipt list, because this had never heard about the change.
 */
function useAppLock() {
  const [ready, setReady] = useState(false);
  const [lock, setLock] = useState<import('./src/lib/appLock').LockState>(AL.INITIAL);
  const [busy, setBusy] = useState(false);
  // Refs, not state: the AppState handler reads them and nothing renders them.
  const ctx = useRef({ enabled: false, available: false });

  const readPreference = useCallback(async () => {
    ctx.current = await readLock();
    return ctx.current;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await readPreference();
      if (!alive) return;
      setLock((prev) => AL.reduce(prev, { type: 'start', now: Date.now() }, c));
      setReady(true);
    })();

    /*
     * A deadline, because `ready` gates the whole app.
     *
     * Both reads catch their own throws, but neither can catch a promise that
     * never settles: a wedged AsyncStorage or a native call that does not
     * return would leave a permanently blank screen that index.tsx's crash net
     * cannot report, which is the class of failure that cost builds 4 and 5.
     * Falling through leaves the app usable and unlocked, which is the same
     * place a user who turned the lock off is in.
     */
    const deadline = setTimeout(() => { if (alive) setReady(true); }, 3000);

    // Settings writes the preference; this is how that reaches the AppState
    // handler before the next foreground.
    const stop = subscribeLock(() => { void readPreference(); });

    return () => { alive = false; clearTimeout(deadline); stop(); };
  }, [readPreference]);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await authenticate()) {
        setLock((prev) => AL.reduce(prev, { type: 'unlocked', now: Date.now() }, ctx.current));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && next !== 'inactive' && next !== 'background') return;
      // Decided from what is already known, so the cover comes off in the same
      // commit as the lock going on, never a few frames earlier.
      setLock((prev) => AL.reduce(prev, { type: next, now: Date.now() }, ctx.current));
      // Then refresh, in case Settings changed the preference while away. This
      // cannot un-decide the transition above; it only corrects the next one.
      if (next === 'active') void readPreference();
    });
    return () => sub.remove();
  }, [readPreference]);

  /*
   * Prompt whenever the app newly needs asking.
   *
   * Keyed on `prompts`, not on `locked`: a user who cancels stays locked, so
   * the next lock event leaves the boolean unchanged and no prompt would ever
   * appear again.
   */
  useEffect(() => {
    if (lock.locked && !busy) void unlock();
    // `busy` is deliberately absent: including it re-prompts the moment a
    // cancelled attempt finishes, which is a loop the user cannot escape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.prompts, lock.locked, unlock]);

  return { ready, locked: lock.locked, covered: lock.covered, busy, unlock };
}

function Root() {
  const T = useTheme();
  const s = makeStyles(T);
  const insets = useSafeAreaInsets();
  const lock = useAppLock();
  // Compliant fallback paywall, shown only if RevenueCat's remote template fails
  // to load. Rendered here so it sits above the tab shell (see purchases.ts).
  const [fallback, setFallback] = useState<{
    packages: PaywallPackage[];
    onChoice: (id: string | 'restore' | 'cancel') => void;
  } | null>(null);

  useEffect(() => {
    registerFallbackPaywall((packages, onChoice) => setFallback({ packages, onChoice }));
    return () => registerFallbackPaywall(null);
  }, []);

  const [tab, setTab] = useState<Tab>('capture');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  // Set when the Capture tab's Recent list is tapped, so the Receipts tab opens
  // that receipt rather than just landing on an unscrolled list.
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);
  const [pro, setPro] = useState(false);

  const refresh = useCallback(async () => {
    setReceipts(await allReceipts());
    setPro(await isPro());
  }, []);

  useEffect(() => {
    initPurchases();
    refresh();
  }, [refresh]);

  // taxtrail://capture -> jump to the scanner. This is what makes a one-action
  // Shortcut worth setting up: Control Centre, Lock Screen or the Action Button
  // land in the camera rather than the last tab used (D-024).
  useEffect(() => {
    const open = (url: string | null) => {
      if (!url) return;
      // Both taxtrail://capture and taxtrail:///capture reach us, and iOS may
      // hand back a trailing slash; compare on the path alone.
      const path = url.replace(/^taxtrail:\/*/, '').replace(/\/+$/, '').split('?')[0];
      if (path === 'capture') setTab('capture');
    };
    Linking.getInitialURL().then(open).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => open(e.url));
    return () => sub.remove();
  }, []);

  /*
   * Nothing of the app renders while locked, and nothing renders before the
   * preference is known: a frame of the receipt list before the lock appears is
   * the whole feature defeated.
   *
   * The StatusBar is built once and rendered by whichever branch wins. Without
   * it on the lock screen the clock and battery keep the previous style, which
   * can be black on black.
   */
  const bar = <StatusBar style={T.scheme === 'light' ? 'dark' : 'light'} />;
  const blank = <View style={{ flex: 1, backgroundColor: T.bg }}>{bar}</View>;

  if (!lock.ready) return blank;
  if (lock.locked) {
    return (
      <View style={{ flex: 1 }}>
        <LockScreen onUnlock={() => { void lock.unlock(); }} busy={lock.busy} />
        {bar}
      </View>
    );
  }

  return (
    <View style={[s.app, { paddingTop: insets.top }]}>
      <FallbackPaywall
        visible={fallback != null}
        packages={fallback?.packages ?? []}
        onPurchase={(id) => { fallback?.onChoice(id); setFallback(null); }}
        onRestore={() => { fallback?.onChoice('restore'); setFallback(null); }}
        onClose={() => { fallback?.onChoice('cancel'); setFallback(null); }}
      />
      <View style={s.header}>
        <Text style={s.brand}>
          Tax<Text style={{ color: T.accent }}>Trail</Text>
        </Text>
        <View style={s.badge}>
          <View style={s.dot} />
          <Text style={s.badgeText}>ON-DEVICE</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'capture' && <CaptureScreen
          onSaved={() => { refresh(); setTab('receipts'); }}
          onSeeAll={(id) => { setOpenReceiptId(id ?? null); setTab('receipts'); }}
          receipts={receipts} pro={pro} onProChanged={refresh} />}
        {tab === 'receipts' && <ReceiptsScreen
          receipts={receipts} onChanged={refresh}
          openId={openReceiptId} onOpened={() => setOpenReceiptId(null)} />}
        {tab === 'summary' && <SummaryScreen receipts={receipts} pro={pro} onChanged={refresh} />}
        {tab === 'settings' && <SettingsScreen receipts={receipts} pro={pro} onChanged={refresh} />}
      </View>

      <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {([
          ['capture', 'camera', 'Capture'],
          ['receipts', 'receipt', 'Receipts'],
          ['summary', 'stats-chart', 'Summary'],
          ['settings', 'settings', 'Settings'],
        ] as [Tab, 'camera' | 'receipt' | 'stats-chart' | 'settings', string][]).map(([key, icon, label]) => {
          const active = tab === key;
          return (
            <Pressable key={key} style={s.tabBtn} onPress={() => { setTab(key); if (key !== 'capture') refresh(); }}>
              <Icon
                name={active ? icon : (`${icon}-outline` as const)}
                size={23}
                color={active ? T.accent : T.muted2}
              />
              <Text style={[s.tabLabel, active && { color: T.accent }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {/*
        The cover is an OVERLAY, not a replacement for the tree.
        Returning early for it unmounted whichever screen was showing, and
        CaptureScreen holds a scanned receipt, its typed corrections and its
        splits in local state until Save. A notification banner would have
        thrown all of that away, along with orphaning the JPEG on disk.

        iOS photographs the screen when the app resigns active, and that
        photograph is what the app switcher shows. This is what it photographs
        instead.
      */}
      {lock.covered && <View style={s.cover} />}
      {/* "light" means light CONTENT — white clock and battery — which is right
          on the dark ground and unreadable on the light one. Driven off the
          palette rather than hardcoded, or light mode ships with an invisible
          status bar. */}
      {bar}
    </View>
  );
}

export default function App() {
  /*
   * The stored theme choice, read before the first paint.
   *
   * What the gate buys is precise: no CONTENT is painted in the wrong palette.
   * It cannot avoid the ground being wrong for a light-mode user during the
   * read, because the choice is in AsyncStorage and there is nothing to read it
   * from synchronously. Dark is the ground either way, as useTheme says.
   *
   * The lock preference is started in the same breath rather than after this
   * resolves, so the two reads overlap instead of queueing.
   */
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    primeLock();
    loadThemeChoice().finally(() => setThemeReady(true));
  }, []);

  /*
   * No GestureHandlerRootView here, deliberately.
   *
   * It was added in build 4 ahead of the feature that needed it, and importing
   * `react-native-gesture-handler` at module scope drags Reanimated's entire
   * runtime into the bundle. That is what crashed build 4 on launch, and the
   * same import would crash build 3 — which has no gesture-handler at all — the
   * moment an update reached it (D-062).
   *
   * It comes back with build 5, together with swipe-to-delete, once a binary
   * has actually been observed to launch with it. `scripts/check-ota-safety.js`
   * fails the build if it reappears before then.
   */
  return (
    <SafeAreaProvider>
      {/* A themed ground rather than null: the platform default is white, and a
          white flash is worse than a dark one on an app that is dark by
          default. */}
      {themeReady ? <Root /> : <View style={{ flex: 1, backgroundColor: DARK.bg }} />}
    </SafeAreaProvider>
  );
}

const makeStyles = styled((T) => ({
  app: { flex: 1, backgroundColor: T.bg },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: T.line, borderBottomWidth: 1,
  },
  brand: { color: T.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  /* Filled with the card colour rather than left transparent. On the deeper
   * light ground (D-083) a bordered-but-empty pill reads as an outline someone
   * forgot to finish; filled, it reads as a badge in both palettes. */
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card,
    borderColor: T.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.good },
  badgeText: { color: T.muted, fontSize: T.fs.xs, fontWeight: '600', letterSpacing: 0.6 },
  tabbar: {
    flexDirection: 'row', borderTopColor: T.line, borderTopWidth: 1,
    backgroundColor: T.bg2, paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { color: T.muted2, fontSize: T.fs.xs, fontWeight: '600' },
}));
