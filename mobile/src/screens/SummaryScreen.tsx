// Summary: totals by tax form/category, sales-tax tracking, exports (CSV free;
// XLSX/TXF/QBO are Pro), JSON backup, version stamp.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '../lib/theme';
import type { Receipt } from '../lib/db';
import { exportRows, isBusiness, allocationsOf } from '../lib/rows';
import { exportCSV, exportTXF, exportQBO, exportXLSX, exportBackup, exportArchive, exportDiagnostics } from '../lib/exportShare';
import { isPro, presentPaywall } from '../lib/purchases';
import { versionStamp } from '../lib/version';
import * as Updates from 'expo-updates';
const C = require('../lib/classifier.js');

export default function SummaryScreen({ receipts, pro, onProChanged }: {
  receipts: Receipt[]; pro: boolean; onProChanged: () => void;
}) {
  const [busyExport, setBusyExport] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'none' | 'error'>('idle');

  // Dev/preview affordance only — never in the shipped app.
  //
  // Fails CLOSED: shown only when the channel is explicitly a non-production
  // one, so an unset or unrecognised channel hides it. Production builds use
  // channel "production" (mobile/eas.json), which is why this needs no manual
  // step before submitting — there is nothing to remember to turn off.
  const showUpdateCheck = Updates.channel === 'development' || Updates.channel === 'preview';

  // A dev client pins whichever update was launched from its launcher and does
  // not poll the channel, so getting a new JS revision otherwise means the dev
  // menu -> Go home -> pick the newest build. This does it in one tap.
  // Harmless in production builds, where it just forces an early check.
  const checkForUpdate = useCallback(async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Not available', 'This build loads JS from a dev server, so there is nothing to fetch.');
      return;
    }
    setUpdateState('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();   // does not return
      } else {
        setUpdateState('none');
      }
    } catch (e) {
      console.warn('update check failed', e);
      setUpdateState('error');
    }
  }, []);


  const stats = useMemo(() => {
    const byForm = new Map<string, Map<string, number>>();
    let bizTotal = 0, personalTotal = 0, taxBiz = 0, taxPersonal = 0;
    for (const r of receipts) {
      const allocs = allocationsOf(r);
      const tot = r.total || allocs.reduce((s, a) => s + a.amount, 0) || 1;
      for (const a of allocs) {
        const form = C.taxFormOf(a.category);
        if (!byForm.has(form)) byForm.set(form, new Map());
        const m = byForm.get(form)!;
        m.set(a.category, (m.get(a.category) || 0) + a.amount);
        if (isBusiness(a.category)) bizTotal += a.amount; else personalTotal += a.amount;
        if (r.salesTax && r.salesTax > 0) {
          const portion = r.salesTax * (a.amount / tot);
          if (isBusiness(a.category)) taxBiz += portion; else taxPersonal += portion;
        }
      }
    }
    const formOrder = ['Schedule C', 'Schedule C Part III (COGS)', 'Form 8829 (Home Office)', 'Form 4562 (Depreciation)', 'Schedule A (Itemized)', 'Review needed', 'None (personal)'];
    const forms = [...byForm.entries()].sort((a, b) => {
      const ia = formOrder.indexOf(a[0]); const ib = formOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return { forms, bizTotal, personalTotal, taxBiz, taxPersonal };
  }, [receipts]);

  const gated = async (name: string, fn: () => Promise<void>, needsPro: boolean) => {
    if (needsPro && !pro) {
      const unlocked = await presentPaywall();
      if (!unlocked) return;
      onProChanged();
    }
    setBusyExport(name);
    try { await fn(); }
    catch (e) { console.warn(e); Alert.alert('Export failed', String(e)); }
    finally { setBusyExport(null); }
  };

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>BUSINESS</Text>
          <Text style={[s.statVal, { color: T.good }]}>${stats.bizTotal.toFixed(2)}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>PERSONAL</Text>
          <Text style={s.statVal}>${stats.personalTotal.toFixed(2)}</Text>
        </View>
      </View>

      {stats.forms.map(([form, cats]) => (
        <View key={form} style={s.card}>
          <Text style={s.formTitle}>{form.toUpperCase()}</Text>
          {[...cats.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <View key={cat} style={s.catLine}>
              <Text style={{ color: T.text, fontSize: 13.5, flex: 1 }} numberOfLines={1}>{cat}</Text>
              <Text style={{ color: T.muted, fontSize: 13.5 }}>${amt.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      {(stats.taxBiz > 0 || stats.taxPersonal > 0) && (
        <View style={s.card}>
          <Text style={s.formTitle}>SALES TAX PAID</Text>
          <View style={s.catLine}><Text style={s.taxLabel}>On business purchases</Text><Text style={{ color: T.muted }}>${stats.taxBiz.toFixed(2)}</Text></View>
          <View style={s.catLine}><Text style={s.taxLabel}>On personal (Schedule A line 5a)</Text><Text style={{ color: T.muted }}>${stats.taxPersonal.toFixed(2)}</Text></View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.formTitle}>EXPORT</Text>
        {([
          ['csv', 'CPA CSV (organized by IRS form)', false, () => exportCSV(receipts)],
          ['xlsx', 'Excel workbook (.xlsx)' + (pro ? '' : '  ·  PRO'), true, () => exportXLSX(receipts)],
          ['txf', 'TXF for tax software' + (pro ? '' : '  ·  PRO'), true, () => exportTXF(receipts)],
          ['qbo', 'QuickBooks 3-column CSV' + (pro ? '' : '  ·  PRO'), true, () => exportQBO(receipts)],
          ['archive', 'Receipt archive (.zip — images + data)', false, () => exportArchive(receipts)],
          ['backup', 'Full JSON backup (data only)', false, () => exportBackup(receipts)],
          ['diag', 'Parser diagnostics (raw OCR text)', false, () => exportDiagnostics(receipts)],
        ] as [string, string, boolean, () => Promise<void>][]).map(([key, label, needsPro, fn]) => (
          <Pressable key={key} style={s.exportBtn} disabled={busyExport != null}
            onPress={() => gated(key, fn, needsPro)}>
            {busyExport === key
              ? <ActivityIndicator color={T.accent} />
              : <Text style={{ color: T.text, fontSize: 14 }}>{label}</Text>}
          </Pressable>
        ))}
      </View>

      {!pro && (
        <Pressable style={s.proBtn} onPress={async () => { if (await presentPaywall()) onProChanged(); }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to TaxTrail Pro</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 }}>
            Unlimited scans · every export format · $39.99/yr
          </Text>
        </Pressable>
      )}

      {showUpdateCheck ? (
        <Pressable onPress={checkForUpdate} disabled={updateState === 'checking'} hitSlop={10}>
          <Text style={s.version}>{versionStamp()}</Text>
          <Text style={[s.version, s.updateLink, { marginTop: 4 }]}>
            {updateState === 'checking' ? 'Checking…'
              : updateState === 'none' ? 'Up to date · tap to check again'
              : updateState === 'error' ? 'Check failed · tap to retry'
              : 'Tap to check for updates'}
          </Text>
        </Pressable>
      ) : (
        <Text style={s.version}>{versionStamp()}</Text>
      )}
      <Text style={[s.version, { marginTop: 2 }]}>
        {pro ? '★ Pro' : 'Free plan'} · {receipts.length} receipt{receipts.length === 1 ? '' : 's'} · 100% on-device
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 14,
  },
  statLabel: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, fontWeight: '600' },
  statVal: { color: T.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 14, marginTop: 12,
  },
  formTitle: { color: T.accent, fontSize: 11, letterSpacing: 0.8, fontWeight: '700', marginBottom: 8 },
  catLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  taxLabel: { color: T.text, fontSize: 13.5, flex: 1 },
  exportBtn: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
  },
  proBtn: {
    backgroundColor: T.accent, borderRadius: T.radius, padding: 16, alignItems: 'center', marginTop: 14,
  },
  version: { color: T.muted2, fontSize: 11, textAlign: 'center', marginTop: 18, letterSpacing: 0.3 },
  updateLink: { color: T.accent, marginTop: 4 },
});
