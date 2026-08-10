// TaxTrail — root component. Custom three-tab shell (no navigation library:
// fewer native deps = safer single EAS build), same layout as the PWA.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { T } from './src/lib/theme';
import { allReceipts, type Receipt } from './src/lib/db';
import { initPurchases, isPro, registerFallbackPaywall } from './src/lib/purchases';
import { FallbackPaywall, type PaywallPackage } from './src/components/FallbackPaywall';
import CaptureScreen from './src/screens/CaptureScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import SummaryScreen from './src/screens/SummaryScreen';

type Tab = 'capture' | 'receipts' | 'summary';

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
          Receipt<Text style={{ color: T.accent }}>Snap</Text>
        </Text>
        <View style={s.badge}>
          <View style={s.dot} />
          <Text style={s.badgeText}>ON-DEVICE</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'capture' && <CaptureScreen onSaved={() => { refresh(); setTab('receipts'); }} />}
        {tab === 'receipts' && <ReceiptsScreen receipts={receipts} onChanged={refresh} />}
        {tab === 'summary' && <SummaryScreen receipts={receipts} pro={pro} onProChanged={refresh} />}
      </View>

      <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {([
          ['capture', '📷', 'Capture'],
          ['receipts', '🧾', 'Receipts'],
          ['summary', '📊', 'Summary'],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <Pressable key={key} style={s.tabBtn} onPress={() => { setTab(key); if (key !== 'capture') refresh(); }}>
            <Text style={{ fontSize: 20, opacity: tab === key ? 1 : 0.45 }}>{icon}</Text>
            <Text style={[s.tabLabel, tab === key && { color: T.accent }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
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
