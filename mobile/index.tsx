/*
 * Entry point, with a diagnostic net around it.
 *
 * Builds 4 and 5 both aborted ~360 ms after launch with a JS fatal, on the
 * expo.controller.errorRecoveryQueue. No JS revision since r21 has ever been
 * observed to run on a device, so although the crash log proves a JavaScript
 * error was thrown, **the text of that error has never been seen by anyone**
 * (D-070). Three revisions were shipped as fixes on a guess about it.
 *
 * expo-updates' recovery pipeline ends in an abort, which destroys the one
 * thing worth having: the message. This catches the throw first and renders it,
 * so the next launch reports the fault instead of vanishing.
 *
 * `require` rather than a static import on purpose — a static import is hoisted
 * and would run App's whole module graph before the try block exists.
 *
 * This is temporary. It comes out as soon as the fault is known.
 */
import React from 'react';
import { registerRootComponent } from 'expo';
import { ScrollView, Text, View } from 'react-native';

function describe(e: any): string {
  if (!e) return 'Threw a falsy value (' + String(e) + ')';
  if (typeof e === 'string') return e;
  const parts = [String(e.name || 'Error') + ': ' + String(e.message || e)];
  if (e.stack) parts.push('', String(e.stack).split('\n').slice(0, 24).join('\n'));
  return parts.join('\n');
}

/** Full-screen, scrollable, selectable. Tyler reads this off a phone. */
function CrashScreen({ when, detail }: { when: string; detail: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#12151a', paddingTop: 64, paddingHorizontal: 16 }}>
      <Text style={{ color: '#ff6b6b', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
        TaxTrail startup error
      </Text>
      <Text style={{ color: '#8b95a5', fontSize: 12, marginBottom: 12 }}>
        {when} · build 5 · js r27 (diagnostic)
      </Text>
      <ScrollView style={{ flex: 1 }}>
        <Text selectable style={{ color: '#e6edf3', fontSize: 12, lineHeight: 18, paddingBottom: 60 }}>
          {detail}
        </Text>
      </ScrollView>
    </View>
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  state = { err: null as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  render() {
    if (this.state.err) {
      return <CrashScreen when="while rendering" detail={describe(this.state.err)} />;
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
    const detail = (isFatal ? '[fatal] ' : '[non-fatal] ') + describe(e);
    if (notifyAsync) notifyAsync(detail);
    else pendingAsync = detail;
    // Only swallow fatals. A non-fatal still goes to the default handler so
    // ordinary warnings behave normally.
    if (!isFatal && previous) previous(e, isFatal);
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
    if (asyncFatal) return <CrashScreen when="after starting" detail={asyncFatal} />;
    return <Boundary><App /></Boundary>;
  };
} catch (e) {
  const detail = describe(e);
  Root = function Failed() {
    return <CrashScreen when="while loading the app" detail={detail} />;
  };
}

registerRootComponent(Root);
