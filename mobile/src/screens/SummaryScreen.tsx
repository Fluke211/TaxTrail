// Summary: totals by tax form/category, sales-tax tracking, and exports
// (CSV free; XLSX/TXF/QBO are Pro).
//
// Subscription, restore, developer options and deletion moved to the Settings
// tab. They were never export steps, and having Manage Subscription sit between
// "Full JSON backup" and a note about QuickBooks date formats meant nobody
// could find it.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { styled, useTheme } from '../lib/theme';
import type { Receipt } from '../lib/db';
import { isBusiness, allocationsOf } from '../lib/rows';
const P = require('../lib/prorate.js');
import { exportCSV, exportTXF, exportQBO, exportXLSX, exportArchive } from '../lib/exportShare';
import { makeRange, filterByRange, yearsPresent, type ExportRange } from '../lib/exportRange';
import { presentPaywall } from '../lib/purchases';
import { versionStamp } from '../lib/version';
const C = require('../lib/classifier.js');

/*
 * What each format is for, in the words of somebody deciding which to tap.
 *
 * Seven buttons with no explanation is a guessing game, and the wrong guess is
 * expensive here: a user who picks "Full JSON backup" thinking it is a backup
 * loses their images on the next reinstall. Tyler asked for an info control on
 * each one; these are the answers.
 */
/*
 * One icon per export format, in the accent colour.
 *
 * Five identical grey rectangles was the shape of this card, and in light mode
 * that is five near-white rectangles on a white card (D-083). The icons are the
 * cheapest place to put brand colour that also earns its keep: the row you want
 * is findable by shape before you have read a word of it.
 */
const EXPORT_ICON: Record<string, string> = {
  csv: 'document-text-outline',
  xlsx: 'grid-outline',
  txf: 'calculator-outline',
  qbo: 'cloud-outline',
  archive: 'archive-outline',
};

const EXPORT_HELP: Record<string, { title: string; body: string }> = {
  csv: {
    title: 'CPA CSV',
    body: 'One row per receipt, grouped by IRS form and Schedule C line, with a '
      + 'sales-tax column that sums to exactly the tax you paid.\n\n'
      + 'This is the one to send an accountant. It opens in Excel, Numbers or '
      + 'Google Sheets, and it is readable by a human without any software.',
  },
  xlsx: {
    title: 'Excel workbook',
    body: 'The same data as the CPA CSV, as a real .xlsx with three sheets: a '
      + 'summary of category totals by tax form, then Schedule C entries and '
      + 'other-form entries on their own filterable tabs.\n\n'
      + 'Choose this over the CSV when you want to sort and filter rather than '
      + 'hand the file to somebody else.',
  },
  txf: {
    title: 'TXF for tax software',
    body: 'The interchange format TurboTax, H&R Block and TaxAct import '
      + 'directly, so category totals land on the right Schedule C lines '
      + 'without retyping.\n\n'
      + 'It carries totals, not individual receipts. Keep the archive for '
      + 'substantiation.',
  },
  qbo: {
    title: 'QuickBooks Online',
    body: 'A three-column CSV (date, description, amount) in the shape QBO\'s '
      + 'bank-transaction importer expects.\n\n'
      + 'At the column-mapping step, set the date format to MM/DD/YYYY. It '
      + 'defaults to day-first, which files anything before the 13th of a '
      + 'month under the wrong month and reports no error.\n\n'
      + 'QuickBooks Desktop cannot import transactions from CSV at all.',
  },
  archive: {
    title: 'Receipt archive (.zip)',
    body: 'Everything: the receipt photographs, the data as JSON, and a CSV, in '
      + 'one file.\n\n'
      + 'This is the one that lets you throw away the paper. The IRS accepts '
      + 'electronic records provided you can produce legible copies on demand, '
      + 'which means the images have to be able to leave the phone.\n\n'
      + 'It is also the only export TaxTrail can read back in, from Settings → '
      + 'Restore from a receipt archive.',
  },
};

export default function SummaryScreen({ receipts, pro, onChanged }: {
  receipts: Receipt[]; pro: boolean; onChanged: () => void;
}) {
  const T = useTheme();
  const s = makeStyles(T);
  const [busyExport, setBusyExport] = useState<string | null>(null);

  /*
   * Which receipts the export covers.
   *
   * Every export used to take all of them while being NAMED for the current
   * year — so `taxtrail-2026.csv` could hold three years of receipts, and last
   * year's return could not be exported at all. Tyler asked for "export all, or
   * year to date, or an entire year"; the options are built from the years that
   * actually have receipts, so nobody is offered an empty 2027 in January.
   */
  const [range, setRange] = useState<ExportRange>(() => makeRange('all'));
  const rangeOptions = useMemo(() => {
    const opts: ExportRange[] = [makeRange('all'), makeRange('ytd')];
    for (const y of yearsPresent(receipts)) {
      // "Year to date" already covers the current year up to today; a whole-year
      // option for it as well would be two buttons that differ only in December.
      if (y !== new Date().getFullYear()) opts.push(makeRange('year', { year: y }));
    }
    return opts;
  }, [receipts]);

  // What the current range actually selects, so the button can say so before
  // the user taps it and so undated receipts are declared rather than dropped.
  const scoped = useMemo(() => filterByRange(receipts, range), [receipts, range]);


  const stats = useMemo(() => {
    const byForm = new Map<string, Map<string, number>>();
    let bizTotal = 0, personalTotal = 0, taxBiz = 0, taxPersonal = 0;
    for (const r of receipts) {
      const allocs = allocationsOf(r);
      const tot = r.total || allocs.reduce((s, a) => s + a.amount, 0) || 1;
      // Same split the exports use, so summing the CSV's "Sales Tax Portion"
      // column gives exactly the figure shown here. Accumulating unrounded
      // shares would be defensible on its own, but it would disagree with the
      // file by a cent — and the CPA reconciling the two has no way to tell
      // which is right.
      const taxParts: (number | null)[] = P.splitSalesTax(
        r.salesTax,
        allocs.map((a) => Math.round((a.amount || 0) * 100)),
        Math.round(tot * 100)
      );
      allocs.forEach((a, ai) => {
        const form = C.taxFormOf(a.category);
        if (!byForm.has(form)) byForm.set(form, new Map());
        const m = byForm.get(form)!;
        m.set(a.category, (m.get(a.category) || 0) + a.amount);
        if (isBusiness(a.category)) bizTotal += a.amount; else personalTotal += a.amount;
        const portion = taxParts[ai];
        if (portion != null) {
          if (isBusiness(a.category)) taxBiz += portion; else taxPersonal += portion;
        }
      });
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
      onChanged();
    }
    setBusyExport(name);
    try { await fn(); }
    catch (e) { console.warn(e); Alert.alert('Export failed', String(e)); }
    finally { setBusyExport(null); }
  };

  const showHelp = useCallback((key: string) => {
    const h = EXPORT_HELP[key];
    if (h) Alert.alert(h.title, h.body);
  }, []);

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
              <Text style={{ color: T.text, fontSize: T.fs.body, flex: 1 }} numberOfLines={1}>{cat}</Text>
              <Text style={{ color: T.muted, fontSize: T.fs.body }}>${amt.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      {(stats.taxBiz > 0 || stats.taxPersonal > 0) && (
        <View style={s.card}>
          <Text style={s.formTitle}>SALES TAX PAID</Text>
          {/* The amounts carry the size explicitly. Without it they fall back to
              RN's default 14 and end up a point smaller than the label beside
              them, and than every other amount on the page. */}
          <View style={s.catLine}>
            <Text style={s.taxLabel}>On business purchases</Text>
            <Text style={s.taxAmount}>${stats.taxBiz.toFixed(2)}</Text>
          </View>
          <View style={s.catLine}>
            <Text style={s.taxLabel}>On personal (Schedule A line 5a)</Text>
            <Text style={s.taxAmount}>${stats.taxPersonal.toFixed(2)}</Text>
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.formTitle}>EXPORT</Text>

        {/* Which receipts go in the file. Stated before the buttons, because it
            changes what every one of them produces. */}
        <View style={s.rangeRow}>
          {rangeOptions.map((r) => {
            const on = r.slug === range.slug;
            return (
              <Pressable key={r.slug} onPress={() => setRange(r)}
                style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && { color: T.accent, fontWeight: '700' }]}>
                  {r.kind === 'all' ? 'All' : r.kind === 'ytd' ? 'This year' : String(r.slug)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.rangeNote}>
          {range.label} · {scoped.receipts.length} receipt{scoped.receipts.length === 1 ? '' : 's'}
          {scoped.undated.length > 0
            ? `. ${scoped.undated.length} undated receipt${scoped.undated.length === 1 ? '' : 's'} cannot be placed in a date range and ${scoped.undated.length === 1 ? 'is' : 'are'} left out. Choose All to include ${scoped.undated.length === 1 ? 'it' : 'them'}.`
            : '.'}
        </Text>

        {([
          ['csv', 'CPA CSV (organized by IRS form)', false, (r: ExportRange) => exportCSV(receipts, r)],
          ['xlsx', 'Excel workbook (.xlsx)' + (pro ? '' : '  ·  PRO'), true, (r: ExportRange) => exportXLSX(receipts, r)],
          ['txf', 'TXF for tax software' + (pro ? '' : '  ·  PRO'), true, (r: ExportRange) => exportTXF(receipts, r)],
          ['qbo', 'QuickBooks Online (3-column CSV)' + (pro ? '' : '  ·  PRO'), true, (r: ExportRange) => exportQBO(receipts, r)],
          ['archive', 'Receipt archive (.zip: images and data)', false, (r: ExportRange) => exportArchive(receipts, r)],
        ] as [string, string, boolean, (r: ExportRange) => Promise<void>][]).map(([key, label, needsPro, fn]) => (
          <View key={key} style={s.exportLine}>
            <Pressable style={[s.exportBtn, { flex: 1, marginBottom: 0 }]} disabled={busyExport != null}
              onPress={() => gated(key, () => fn(range), needsPro)}>
              {busyExport === key
                ? <ActivityIndicator color={T.accent} />
                : (
                  <View style={s.exportRow}>
                    <Icon name={EXPORT_ICON[key] ?? 'document-text-outline'} size={20} color={T.accent} />
                    <Text style={{ color: T.text, fontSize: T.fs.body, flex: 1 }}>{label}</Text>
                  </View>
                )}
            </Pressable>
            {/* Seven buttons with no explanation is a guessing game, and the
                wrong guess loses images. Tyler asked for these. */}
            <Pressable onPress={() => showHelp(key)} hitSlop={8} style={s.infoBtn}
              accessibilityLabel={`What is ${label}?`}>
              <Icon name="information-circle-outline" size={20} color={T.muted} />
            </Pressable>
          </View>
        ))}
      </View>

      {!pro && (
        <Pressable style={s.proBtn} onPress={async () => { if (await presentPaywall()) onChanged(); }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: T.fs.body }}>Upgrade to TaxTrail Pro</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: T.fs.sm, marginTop: 3 }}>
            Unlimited scans · every export format · $39.99/yr
          </Text>
        </Pressable>
      )}

      {/*
        The version stamp stays in the Summary footer. It is one of Tyler's
        standing rules ("the Expo app shows it in the Summary footer via
        version.ts"), and it silently drifted once already (D-039), so it is not
        a thing to relocate on a tidiness argument.

        Settings has a second copy, because that is where the tap-to-unlock
        gesture and the update check live. Both call versionStamp(), so they
        cannot disagree.
      */}
      <Text style={s.version}>{versionStamp()}</Text>
      <Text style={[s.version, { marginTop: 2 }]}>
        {pro ? '★ Pro' : 'Free plan'} · {receipts.length} receipt{receipts.length === 1 ? '' : 's'} · 100% on-device
      </Text>
    </ScrollView>
  );
}

const makeStyles = styled((T) => ({
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 14,
  },
  statLabel: { color: T.muted2, fontSize: T.fs.xs, letterSpacing: 0.6, fontWeight: '600' },
  statVal: { color: T.text, fontSize: 24, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 14, marginTop: 12,
  },
  formTitle: { color: T.accent, fontSize: T.fs.xs, letterSpacing: 0.8, fontWeight: '700', marginBottom: 8 },
  catLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  taxLabel: { color: T.text, fontSize: T.fs.body, flex: 1 },
  taxAmount: { color: T.muted, fontSize: T.fs.body },
  exportBtn: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
  },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoBtn: { padding: 6 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderColor: T.line, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: T.card2,
  },
  chipOn: { borderColor: T.accentLine, backgroundColor: T.accentSoft },
  chipText: { color: T.muted, fontSize: T.fs.md, fontWeight: '600' },
  rangeNote: { color: T.muted2, fontSize: T.fs.sm, lineHeight: T.lh.sm, marginBottom: 10 },
  proBtn: {
    backgroundColor: T.accent, borderRadius: T.radius, padding: 16, alignItems: 'center', marginTop: 14,
  },
  version: { color: T.muted2, fontSize: T.fs.xs, textAlign: 'center', marginTop: 18, letterSpacing: 0.3 },
  updateLink: { color: T.accent, marginTop: 4 },
  restoreNote: { color: T.muted2, fontSize: T.fs.sm, lineHeight: T.lh.sm, marginTop: 8 },
}));
