/*
 * Entry point, with a startup net around it.
 *
 * Why it exists: builds 4 and 5 both aborted ~360 ms after launch with a JS
 * fatal on the expo.controller.errorRecoveryQueue, and expo-updates' recovery
 * pipeline ends in an abort — which destroys the one thing worth having, the
 * message. Three JS revisions were shipped as fixes for an error nobody had
 * read (D-070). The net catches the throw first and renders it; the very first
 * launch with it reported `Cannot find native module 'ExpoFontLoader'` and the
 * four-day crash was solved that hour (D-072).
 *
 * `require` rather than a static import on purpose — a static import is hoisted
 * and would run App's whole module graph before the try block exists.
 *
 * D-071 said this comes out once build 6 is observed to launch. Build 6 launched
 * on 2026-09-02, and it stays — as a permanent net rather than a diagnostic
 * (D-074). What changed is who reads it: a stranger who taps the icon gets a
 * sentence they can act on, and the stack trace lives behind a toggle.
 *
 * Everything below stays self-contained on purpose. It imports react, expo and
 * react-native and nothing of the app's, because any project module it reached
 * for could be the module that failed. So the theme is not used at all — the
 * crash screen carries its own four colours — and the version file and
 * expo-updates are reached through guarded requires.
 */
import React from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';

function describe(e: any): string {
  if (!e) return 'Threw a falsy value (' + String(e) + ')';
  if (typeof e === 'string') return e;
  const parts = [String(e.name || 'Error') + ': ' + String(e.message || e)];
  if (e.stack) parts.push('', String(e.stack).split('\n').slice(0, 24).join('\n'));
  return parts.join('\n');
}

const SUPPORT_EMAIL = 'support@taxtrail.app';

/*
 * Two hand-written palettes rather than `src/lib/theme.ts`.
 *
 * Same reason as the guarded require below: the theme is app code, and app code
 * is what just failed. `useColorScheme()` comes from react-native itself, so
 * following the system setting costs no dependency.
 *
 * The light half is latent today: `app.json` sets `userInterfaceStyle: "dark"`,
 * which pins the window's trait collection, so `useColorScheme()` returns
 * 'dark' even on a phone set to Light. It is written anyway so that flipping
 * app.json to "automatic" does not leave a hardcoded dark panel behind — the
 * same reason `src/lib/theme.ts` carries a LIGHT palette.
 *
 * `npm run test:contrast` reads this literal, so the ratios are checked rather
 * than asserted in a comment.
 */
const PALETTE = {
  dark: { bg: '#12151a', text: '#e6edf3', muted: '#8b95a5', accent: '#6f93ff' },
  light: { bg: '#f6f7f9', text: '#111827', muted: '#525d6d', accent: '#2b52c9' },
};

/*
 * The app version, read through a guarded require, and deliberately WITHOUT the
 * build number.
 *
 * `APP_BUILD` is a JavaScript constant, so an OTA pushes it to every live
 * binary: this bundle running on a build-5 phone would report "build 6" and
 * send whoever read it off debugging the wrong binary — the exact misdirection
 * that cost four days. The JS revision is the one thing a bundle can state
 * truthfully about itself, and it is what identifies the code in the trace.
 */
function jsStamp(): string {
  try {
    const v = require('./src/lib/version');
    return `TaxTrail v${v.APP_VERSION} · js r${v.JS_REVISION}`;
  } catch {
    // Nothing better is knowable from here: if the version module did not load,
    // this bundle cannot name its own revision. Say which part is missing
    // rather than printing a plausible wrong number.
    return 'TaxTrail · version file unreadable';
  }
}

/*
 * What a person sees when startup fails.
 *
 * Plain sentence first: whoever is holding the phone may have no idea what a
 * stack trace is, and a wall of Hermes frames is not something they can act on.
 * The reassurance is the part that matters — saved receipts are in a local
 * database this screen never touches.
 *
 * The detail is one tap away, still selectable, because that is the whole
 * reason this file exists. `when` and the version stamp stay VISIBLE rather
 * than going behind the toggle: the likeliest thing a non-technical user does
 * is screenshot the screen, and a screenshot missing those two is the report
 * that cost four days.
 */
/*
 * Ask expo-updates for a newer bundle, fetch it, and restart into it.
 *
 * This is the price of the handler below not re-throwing. expo-updates' own
 * ErrorRecovery rolls a crashing binary back to its last good bundle, and it is
 * reached through the fatal handler — which this file installs itself over, so
 * that the message survives. Keeping the message means giving up the automatic
 * rollback, so the recovery becomes a button the user can press instead
 * (D-074).
 *
 * Not automatic, and not the primary instruction: `checkAutomatically` is
 * ON_LOAD, so force-quitting and reopening already fetches a fix on one launch
 * and applies it on the next. This turns two launches into one tap for someone
 * who is stuck.
 *
 * Guarded require, like everything else here — expo-updates is in every live
 * binary, but a net that throws while reporting a throw is worse than no net.
 */
type RecoverState = 'idle' | 'checking' | 'none' | 'failed';

async function fetchAndRestart(): Promise<RecoverState> {
  try {
    const U = require('expo-updates');
    const res = await U.checkForUpdateAsync();
    if (!res?.isAvailable) return 'none';
    await U.fetchUpdateAsync();
    await U.reloadAsync();
    // Practically unreachable — reloadAsync restarts the app. Back to 'idle'
    // rather than staying on 'Checking…' if it ever resolves without doing so,
    // so the button is still pressable.
    return 'idle';
  } catch {
    return 'failed';
  }
}

function CrashScreen({ phase, when, detail }: {
  /** Which net caught it. NOT derived from `when`: the caption is display text
   *  and someone rewording it must not silently change what the screen says. */
  phase: 'load' | 'render' | 'runtime';
  when: string;
  detail: string;
}) {
  const [showDetail, setShowDetail] = React.useState(false);
  const [recover, setRecover] = React.useState<RecoverState>('idle');
  const C = useColorScheme() === 'light' ? PALETTE.light : PALETTE.dark;
  // "couldn't start" is only true for the load path. A render throw twenty
  // minutes into a session did not stop the app from starting.
  const atLaunch = phase === 'load';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 72, paddingHorizontal: 20 }}>
      <Text style={{ color: C.text, fontSize: 19, fontWeight: '700', marginBottom: 8 }}>
        {atLaunch ? 'TaxTrail couldn\u2019t start' : 'TaxTrail hit an error'}
      </Text>
      <Text selectable style={{ color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 }}>
        {atLaunch
          ? 'Your receipts are safe. They live in a database on this device, which this screen does not touch. Force-quit and reopen the app.'
          : 'Every receipt you have saved is safe. They live in a database on this device, which this screen does not touch. Force-quit and reopen the app.'}
        {' If it keeps happening, email '}
        <Text style={{ color: C.text, fontWeight: '600' }}>{SUPPORT_EMAIL}</Text>
        {' with the details below.'}
      </Text>
      <Text selectable style={{ color: C.muted, fontSize: 11, marginTop: 12 }}>
        {when} · {jsStamp()}
      </Text>
      <Pressable
        onPress={async () => {
          if (recover === 'checking') return;
          setRecover('checking');
          setRecover(await fetchAndRestart());
        }}
        accessibilityRole="button"
        accessibilityLabel="Check for an update"
        accessibilityState={{ disabled: recover === 'checking' }}
        hitSlop={8}
        style={({ pressed }) => ({
          alignSelf: 'flex-start', marginTop: 14, paddingVertical: 13, paddingHorizontal: 18,
          borderRadius: 12, borderWidth: 1, borderColor: C.accent, opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: C.accent, fontSize: 15, fontWeight: '600' }}>
          {recover === 'checking' ? 'Checking…' : 'Check for an update'}
        </Text>
      </Pressable>
      {recover === 'none' && (
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
          No update available yet. Force-quit and reopen to try again.
        </Text>
      )}
      {recover === 'failed' && (
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
          Couldn’t reach the update service. Check your connection and try again.
        </Text>
      )}
      <Pressable
        onPress={() => setShowDetail((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetail }}
        hitSlop={8}
        style={({ pressed }) => ({
          alignSelf: 'flex-start', paddingVertical: 14, paddingRight: 16, opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: C.accent, fontSize: 15, fontWeight: '600' }}>
          {showDetail ? 'Hide technical details' : 'Show technical details'}
        </Text>
      </Pressable>
      {showDetail && (
        <ScrollView style={{ flex: 1 }}>
          <Text selectable style={{ color: C.text, fontSize: 12, lineHeight: 18, paddingBottom: 60 }}>
            {detail}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  state = { err: null as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  render() {
    if (this.state.err) {
      return <CrashScreen phase="render" when="while rendering" detail={describe(this.state.err)} />;
    }
    return this.props.children as React.ReactElement;
  }
}

/*
 * The third net, and probably the one that matters.
 *
 * The crash log shows the JS thread parked in its run loop with the process
 * aborting 361 ms in — which is what an error thrown AFTER the first render
 * looks like: an async rejection or a native callback, not a module-evaluation
 * throw. Neither the try/catch below nor the error boundary above can see
 * those. RN routes them through ErrorUtils, and expo-updates' handler turns a
 * fatal one into the abort we keep getting.
 *
 * Installing our own handler first means the message is rendered instead. It
 * deliberately does NOT re-throw: a broken app that can tell you why beats a
 * dead one that cannot.
 */
let notifyAsync: ((detail: string) => void) | null = null;
let pendingAsync: string | null = null;

const EU = (global as any).ErrorUtils;
if (EU && typeof EU.setGlobalHandler === 'function') {
  const previous = typeof EU.getGlobalHandler === 'function' ? EU.getGlobalHandler() : null;
  EU.setGlobalHandler((e: any, isFatal?: boolean) => {
    // A non-fatal goes to the default handler and NOWHERE else.
    //
    // It used to also raise the crash screen, which meant any library reporting
    // a soft exception — RevenueCat, expo-updates, React itself — could replace
    // a perfectly healthy app with an error page, and take an unsaved scan sat
    // in the review form down with it. Only a fatal earns the whole screen.
    //
    // Not forwarding a fatal has a price, and it is deliberate: `previous` is
    // what reaches expo-updates' ErrorRecovery, so swallowing it gives up the
    // automatic rollback to the last good bundle. The message is worth more
    // than the rollback here — four days say so — and the crash screen offers
    // the recovery as a button instead (D-074).
    if (!isFatal) {
      if (previous) previous(e, isFatal);
      return;
    }
    const detail = describe(e);
    if (notifyAsync) notifyAsync(detail);
    else pendingAsync = detail;
  });
}

function useAsyncFatal(): string | null {
  const [detail, setDetail] = React.useState<string | null>(pendingAsync);
  React.useEffect(() => {
    notifyAsync = setDetail;
    if (pendingAsync) setDetail(pendingAsync);
    return () => { notifyAsync = null; };
  }, []);
  return detail;
}

let Root: React.ComponentType;
try {
  const App = require('./App').default;
  Root = function Wrapped() {
    const asyncFatal = useAsyncFatal();
    if (asyncFatal) return <CrashScreen phase="runtime" when="after starting" detail={asyncFatal} />;
    return <Boundary><App /></Boundary>;
  };
} catch (e) {
  const detail = describe(e);
  Root = function Failed() {
    return <CrashScreen phase="load" when="while loading the app" detail={detail} />;
  };
}

registerRootComponent(Root);
