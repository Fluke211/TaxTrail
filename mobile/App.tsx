// TaxTrail — root component. Custom four-tab shell (no navigation library:
// fewer native deps = safer single EAS build).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import Icon from './src/components/Icon';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DARK, styled, useTheme } from './src/lib/theme';
import { loadThemeChoice } from './src/lib/appearance';
import { authenticate, isLockAvailable, isLockEnabled } from './src/lib/appLockNative';
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
 * Three states, and the difference between them is the whole design:
 *
 *  - **locked**: authentication is required. The lock screen shows and prompts.
 *  - **covered**: the app has resigned active, so iOS is about to take the
 *    snapshot it shows in the app switcher. Content is hidden, nothing is
 *    asked. Without this the switcher shows the receipt list to anyone holding
 *    the phone, unlocked, which is the thing the feature exists to prevent.
 *  - neither: the app is in use.
 *
 * **`inactive` is not `background`.** iOS fires `inactive` for the Face ID
 * prompt itself, for Control Centre, and for a notification banner. It covers,
 * because a snapshot may follow; it never starts the clock. Only a real
 * `background` does, and the clock is consumed on the way back so an
 * inactive/active blip can never be read as time away. Getting this wrong locks
 * the app again the instant the prompt it raised is dismissed, which is a loop
 * with no way out.
 */
function useAppLock() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  // Refs, not state: the AppState handler reads them, nothing renders them.
  const enabled = useRef(false);
  const available = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [on, can] = await Promise.all([isLockEnabled(), isLockAvailable()]);
      if (!alive) return;
      enabled.current = on;
      available.current = can;
      setReady(true);
      // A cold start: no previous foreground to lean on, which shouldLock reads
      // as "ask".
      setLocked(AL.shouldLock({ enabled: on, available: can, backgroundedAt: null, now: Date.now() }));
    })();
    return () => { alive = false; };
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await authenticate()) {
        backgroundedAt.current = null;
        setLocked(false);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'inactive' || next === 'background') {
        if (enabled.current && available.current) setCovered(true);
        if (next === 'background') backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      setCovered(false);

      // Nothing to judge unless the app actually left. An inactive/active blip
      // leaves this null, and reading null here as a cold start is the loop.
      const wasAway = backgroundedAt.current;
      backgroundedAt.current = null;
      if (wasAway == null) return;

      // Re-read the preference: Settings may have just changed it.
      (async () => {
        const [on, can] = await Promise.all([isLockEnabled(), isLockAvailable()]);
        enabled.current = on;
        available.current = can;
        if (AL.shouldLock({ enabled: on, available: can, backgroundedAt: wasAway, now: Date.now() })) {
          setLocked(true);
        }
      })();
    });
    return () => sub.remove();
  }, []);

  // Prompt as soon as the lock screen appears, and again whenever it re-locks,
  // so the normal case is one glance rather than a tap and then a glance.
  useEffect(() => {
    if (locked && !busy) void unlock();
    // `busy` is deliberately absent: including it re-prompts the moment a
    // cancelled attempt finishes, which is a loop the user cannot escape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, unlock]);

  return { ready, locked, covered, busy, unlock };
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
   * Nothing of the app renders while locked or covered, and nothing renders
   * before the preference is known either: a frame of the receipt list before
   * the lock appears is the whole feature defeated, and it is a real risk
   * because the preference comes from AsyncStorage.
   *
   * Each branch carries its own StatusBar. Without it the clock and battery
   * keep the previous style, and on the one screen a user is forced to look at
   * they can end up black on black.
   */
  const bar = <StatusBar style={T.scheme === 'light' ? 'dark' : 'light'} />;
  if (!lock.ready) return <View style={{ flex: 1, backgroundColor: T.bg }}>{bar}</View>;
  if (lock.locked) {
    return (
      <View style={{ flex: 1 }}>
        <LockScreen onUnlock={() => { void lock.unlock(); }} busy={lock.busy} />
        {bar}
      </View>
    );
  }
  // Covered, not locked: the app switcher's snapshot must not carry the receipt
  // list. No prompt here, because resigning active is not the user leaving.
  if (lock.covered) return <View style={{ flex: 1, backgroundColor: T.bg }}>{bar}</View>;

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
      {/* "light" means light CONTENT — white clock and battery — which is right
          on the dark ground and unreadable on the light one. Driven off the
          palette rather than hardcoded, or light mode ships with an invisible
          status bar. */}
      <StatusBar style={T.scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

export default function App() {
  /*
   * The stored theme choice, read before the first paint. Without the gate a
   * light-mode user gets a dark frame first, which looks like a flash of the
   * wrong app (D-077).
   */
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => { loadThemeChoice().finally(() => setThemeReady(true)); }, []);

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
          white flash is the wrong-appearance flash this gate exists to avoid,
          just inverted. Dark is the safer default, as useTheme says. */}
      {themeReady ? <Root /> : <View style={{ flex: 1, backgroundColor: DARK.bg }} />}
    </SafeAreaProvider>
  );
}

const makeStyles = styled((T) => ({
  app: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: T.line, borderBottomWidth: 1,
  },
  brand: { color: T.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderColor: T.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.good },
  badgeText: { color: T.muted, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.6 },
  tabbar: {
    flexDirection: 'row', borderTopColor: T.line, borderTopWidth: 1,
    backgroundColor: T.bg2, paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { color: T.muted2, fontSize: 11, fontWeight: '600' },
}));
