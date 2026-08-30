// TaxTrail — root component. Custom four-tab shell (no navigation library:
// fewer native deps = safer single EAS build).
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { T } from './src/lib/theme';
import { allReceipts, type Receipt } from './src/lib/db';
import { initPurchases, isPro, registerFallbackPaywall } from './src/lib/purchases';
import { FallbackPaywall, type PaywallPackage } from './src/components/FallbackPaywall';
import CaptureScreen from './src/screens/CaptureScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type Tab = 'capture' | 'receipts' | 'summary' | 'settings';

function Root() {
  const insets = useSafeAreaInsets();
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
        {tab === 'capture' && <CaptureScreen onSaved={() => { refresh(); setTab('receipts'); }} />}
        {tab === 'receipts' && <ReceiptsScreen receipts={receipts} onChanged={refresh} />}
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
              <Ionicons
                name={active ? icon : (`${icon}-outline` as const)}
                size={23}
                color={active ? T.accent : T.muted2}
              />
              <Text style={[s.tabLabel, active && { color: T.accent }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  // GestureHandlerRootView has to be the OUTERMOST view or gesture-handler's
  // recognizers never receive touches — the failure is silent, a swipe simply
  // does nothing. Added with the module rather than with the feature that uses
  // it, so build 4 carries it and swipe-to-delete can then ship over the air.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
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
});
