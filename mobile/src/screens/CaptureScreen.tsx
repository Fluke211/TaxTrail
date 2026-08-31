// Capture flow: hero → camera/library → OCR → review form with the photo pinned
// at the top (scan controls hidden until Save or Discard — same UX as PWA v5.5).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styled, useTheme } from '../lib/theme';
import { addReceipt, countAll, countThisMonth, type Allocation, type Receipt } from '../lib/db';
import { processReceiptPages } from '../lib/ocr';
import { memLookup, memLearn, taxMemLookup, taxMemLearn } from '../lib/memory';
import { isPro, presentPaywall } from '../lib/purchases';
import { FREE_SCANS_PER_MONTH, ASK_REVIEW_AFTER_SCANS } from '../lib/config';
const G = require('../lib/gates.js');

// Namespaced like the other stored keys (see memory.ts).
const REVIEW_ASKED_KEY = 'rs.reviewAsked.v1';
import { SC_BY_NAME } from '../lib/rows';
import { ZoomableImage } from '../components/ZoomableImage';
import { CategoryPicker } from '../components/CategoryPicker';
const C = require('../lib/classifier.js');
const E = require('../lib/edited.js');

const CATEGORY_NAMES: string[] = (C.CATEGORIES as { name: string }[]).map((c) => c.name);

interface Pending {
  imagePath: string;
  thumbPath: string;
  ocrText: string;
  merchant: string;
  date: string;
  total: string;
  salesTax: string;
  taxRate: number | null;
  rateSource: string;
  category: string;
  confidence: string;
  merchantRemembered: boolean;
  city: string | null;
  // What the classifier said, frozen before the merchant-memory override and
  // before the user touches anything. Saved with the receipt so a correction
  // becomes a labelled fixture rather than just a changed row (edited.js).
  parsedSnapshot: string;
}

export default function CaptureScreen({ onSaved, onSeeAll, receipts, pro, onProChanged }: {
  onSaved: () => void;
  /** Opens the Receipts tab. With an id, that receipt's detail opens too. */
  onSeeAll: (highlightId?: number) => void;
  receipts: Receipt[];
  pro: boolean;
  /** Called after a paywall purchase so the meter stops showing the free tier. */
  onProChanged: () => void;
}) {
  const T = useTheme();
  const s = makeStyles(T);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notes, setNotes] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [splitCat, setSplitCat] = useState('Personal (non-deductible)');
  const [splitAmt, setSplitAmt] = useState('');
  const [splitTax, setSplitTax] = useState(true);
  const [showSplits, setShowSplits] = useState(false);
  const [showSplitCats, setShowSplitCats] = useState(false);

  // Scans used this calendar month, for the free-tier meter. Recomputed
  // whenever the receipt list changes, which is what a save does.
  const [scansThisMonth, setScansThisMonth] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    countThisMonth().then((n) => { if (alive) setScansThisMonth(n); }).catch(() => {});
    return () => { alive = false; };
  }, [receipts.length]);

  // null for Pro, and that is deliberate — the meter is a free-tier thing.
  // Held back until the count arrives so the bar cannot flash a wrong width.
  const meter = useMemo(
    () => (scansThisMonth === null
      ? null
      : G.freeScanMeter({ isPro: pro, scansThisMonth, limit: FREE_SCANS_PER_MONTH })),
    [pro, scansThisMonth],
  );

  // Sorted by createdAt, NOT by the list's own order. allReceipts() orders by
  // `date`, which is a field the user can type into — so a receipt scanned just
  // now but dated last June sorts to the bottom and never shows up here, which
  // reads as a failed save. "Recent" means recently scanned.
  const recents = useMemo(
    () => receipts.slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : (b.id ?? 0) - (a.id ?? 0)))
      .slice(0, 4),
    [receipts],
  );

  const startScan = useCallback(async (fromLibrary: boolean) => {
    // Free-tier gate before the camera opens. The decision itself lives in
    // gates.js so the boundary is unit-tested rather than only reachable by
    // scanning eleven receipts on a phone.
    // Re-read Pro live rather than trusting the `pro` prop: the prop is for
    // display, this decides whether a paywall appears.
    const proNow = await isPro();
    if (G.isOverFreeLimit({ isPro: proNow, scansThisMonth: await countThisMonth(), limit: FREE_SCANS_PER_MONTH })) {
      const unlocked = await presentPaywall();
      if (!unlocked) return;
      // Tell App.tsx to re-read entitlement. Without this the `pro` prop stays
      // false and a user who just paid keeps looking at a full red meter that
      // says they have no scans left.
      onProChanged();
    }
    const perm = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'TaxTrail needs access to scan receipts. Everything stays on this device.');
      return;
    }
    // Camera path goes through VisionKit's document scanner: it finds the
    // receipt's edges, corrects perspective and boosts contrast before Apple
    // Vision ever sees the image. A flat, deskewed scan is worth far more than
    // any amount of parser tuning on a photo of a curled receipt. It also
    // captures multiple pages, which a single frame cannot do for long receipts.
    // The library path stays on ImagePicker — the scanner is camera-only.
    let uris: string[] = [];
    if (fromLibrary) {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets?.length) return;
      uris = [result.assets[0].uri];
    } else {
      try {
        const { scannedImages } = await DocumentScanner.scanDocument({
          croppedImageQuality: 100,
          responseType: ResponseType.ImageFilePath,
        });
        // Empty means the user backed out of the scanner.
        if (!scannedImages?.length) return;
        uris = scannedImages;
      } catch (e) {
        // Never let a scanner problem block capture — fall back to a plain photo.
        console.warn('document scanner unavailable, falling back to camera', e);
        const result = await ImagePicker.launchCameraAsync({ quality: 1 });
        if (result.canceled || !result.assets?.length) return;
        uris = [result.assets[0].uri];
      }
    }

    setBusy(true);
    try {
      const { text, imagePath, thumbPath } = await processReceiptPages(uris);
      const parsed = C.parseReceipt(text);
      const remembered = await memLookup(text);
      const merchant = remembered || parsed.merchant || '';
      let category = parsed.category;
      if (remembered && parsed.category === 'Uncategorized') {
        const recls = C.classify(text, remembered);
        if (recls.name !== 'Uncategorized') category = recls.name;
      }
      // Tax-rate priority: printed on receipt > saved city rate > derived > last used
      const mem = await taxMemLookup(parsed.city);
      let taxRate: number | null = null; let rateSource = 'not detected';
      if (parsed.taxRatePrinted) { taxRate = parsed.taxRatePrinted; rateSource = 'printed on receipt'; }
      else if (mem?.fromCity) { taxRate = mem.rate; rateSource = 'remembered for this city'; }
      else if (parsed.taxRate) { taxRate = parsed.taxRate; rateSource = 'derived from receipt'; }
      else if (mem) { taxRate = mem.rate; rateSource = 'last used'; }

      setPending({
        imagePath, thumbPath, ocrText: text,
        merchant,
        date: parsed.date || new Date().toISOString().slice(0, 10),
        total: parsed.total != null ? parsed.total.toFixed(2) : '',
        salesTax: parsed.taxTotal && parsed.taxTotal > 0 ? parsed.taxTotal.toFixed(2) : '',
        taxRate, rateSource,
        category, confidence: parsed.confidence,
        merchantRemembered: !!remembered,
        city: parsed.city,
        // `parsed`, not the values above: the merchant-memory override and the
        // tax-rate fallbacks are the app being helpful, and folding them in
        // would credit the parser with answers it did not produce.
        parsedSnapshot: JSON.stringify(E.snapshotOf(parsed)),
      });
      setNotes(''); setAllocs([]); setShowRaw(false); setShowSplits(false);
    } catch (e) {
      console.warn(e);
      Alert.alert('Scan failed', 'Could not read that photo — try again with more light and the receipt flat.');
    } finally {
      setBusy(false);
    }
  }, [onProChanged]);

  const discard = useCallback(() => { setPending(null); }, []);

  const save = useCallback(async () => {
    if (!pending) return;
    const total = parseFloat(pending.total) || 0;
    const salesTax = parseFloat(pending.salesTax);
    const merchant = pending.merchant.trim() || 'Unknown merchant';
    // Splits are capped at the receipt total (D-049), so the leftover cannot be
    // negative. It CAN be exactly zero when the splits account for the whole
    // receipt — and a $0.00 allocation would then become a $0.00 line in the
    // CPA export, which is clutter a human has to read past and decide is
    // nothing. Nothing left over means nothing to file under the base category.
    const remainder = Math.round((total - allocs.reduce((s, a) => s + a.amount, 0)) * 100) / 100;
    const fullAllocs: Allocation[] = allocs.length
      ? (remainder > 0
        ? [{ category: pending.category, scheduleC: SC_BY_NAME[pending.category] || '', amount: remainder }, ...allocs]
        : [...allocs])
      : [];
    const id = await addReceipt({
      createdAt: new Date().toISOString(),
      merchant,
      date: pending.date,
      total,
      category: pending.category,
      scheduleC: SC_BY_NAME[pending.category] || '',
      notes: notes.trim(),
      salesTax: salesTax > 0 ? Math.round(salesTax * 100) / 100 : null,
      taxRate: pending.taxRate,
      allocations: fullAllocs,
      confidence: pending.confidence,
      ocrText: pending.ocrText,
      imagePath: pending.imagePath,
      thumbPath: pending.thumbPath,
      parsedSnapshot: pending.parsedSnapshot,
    });
    const learned = await memLearn(pending.ocrText, merchant);
    await taxMemLearn(pending.city, pending.taxRate);
    setPending(null);
    onSaved();
    Alert.alert('Saved ✓', learned ? `I'll remember this store as "${merchant}"` : `${merchant} — $${total.toFixed(2)}`);
    // Ratings flywheel: ask once, ever, after the Nth successful scan. Keyed on
    // the LIFETIME count with a persisted flag — the old `countThisMonth() === 3`
    // re-fired every month and could be skipped entirely (see gates.js).
    try {
      const asked = await AsyncStorage.getItem(REVIEW_ASKED_KEY);
      if (G.shouldAskForReview({
        lifetimeScans: await countAll(),
        alreadyAsked: asked === '1',
        askAfter: ASK_REVIEW_AFTER_SCANS,
      }) && (await StoreReview.hasAction())) {
        // Record BEFORE asking: if the dialog throws or iOS silently declines
        // to show it, we still do not pester on every subsequent save.
        await AsyncStorage.setItem(REVIEW_ASKED_KEY, '1');
        StoreReview.requestReview();
      }
    } catch {}
    // id used only to keep TS satisfied about the awaited insert
    void id;
  }, [pending, notes, allocs, onSaved]);

  // Declared here rather than just above the render, because addSplit needs the
  // receipt total to cap a split against it.
  const allocated = allocs.reduce((s, a) => s + a.amount, 0);
  const totalNum = pending ? parseFloat(pending.total) || 0 : 0;

  const addSplit = useCallback(() => {
    if (!pending) return;
    const amt = parseFloat(splitAmt);
    if (!amt || amt <= 0) return;
    const rate = pending.taxRate || 0;
    const withTax = splitTax && rate > 0;
    const amount = Math.round(amt * (withTax ? 1 + rate : 1) * 100) / 100;

    // Splits must not exceed the receipt. Nothing used to stop them: save()
    // stores the leftover as total - sum(allocations), so two $30 splits on a
    // $50 receipt saved a -$10 allocation. That negative flowed into every
    // export — the TXF file got a malformed "$--10.00" record — and the
    // remainder hint clamped itself to $0.00, so the screen said the split
    // balanced when it did not.
    // A blank or unparsed total is a different problem from an over-split one,
    // and saying "the whole receipt is already split" when no total was read
    // sends the user looking for splits that are not there.
    if (totalNum <= 0) {
      Alert.alert('Set the receipt total first',
        'Splits are measured against the total, so enter it above before splitting.');
      return;
    }
    const left = Math.round((totalNum - allocated) * 100) / 100;
    if (amount > left) {
      Alert.alert(
        'That is more than the receipt',
        left <= 0
          ? 'The whole receipt is already split. Remove a split first.'
          : `Only $${left.toFixed(2)} of this $${totalNum.toFixed(2)} receipt is left to split.`
      );
      return;
    }

    const alloc: Allocation = {
      category: splitCat,
      scheduleC: SC_BY_NAME[splitCat] || '',
      amount,
      ...(withTax ? { base: amt, tax: Math.round(amt * rate * 100) / 100 } : {}),
    };
    setAllocs((a) => [...a, alloc]);
    setSplitAmt('');
  }, [pending, splitAmt, splitCat, splitTax, allocated, totalNum]);

  const splitPreview = useMemo(() => {
    const amt = parseFloat(splitAmt);
    if (!pending || !amt || amt <= 0) return null;
    const rate = pending.taxRate || 0;
    if (!splitTax || rate <= 0) return `$${amt.toFixed(2)}`;
    const tax = amt * rate;
    return `$${amt.toFixed(2)} + $${tax.toFixed(2)} tax = $${(amt + tax).toFixed(2)}`;
  }, [pending, splitAmt, splitTax]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {!pending && !busy && (
        <>
          {/* Concept A: the rectangle IS the button. There is no second
              "Scan Receipt" control below it any more — two buttons doing the
              same thing made the big one look decorative. */}
          <Pressable
            style={({ pressed }) => [s.hero, pressed && s.heroPressed]}
            onPress={() => startScan(false)}
            accessibilityRole="button"
            accessibilityLabel="Scan a receipt with the camera"
          >
            <Ionicons name="scan-outline" size={56} color={T.accent} />
            <Text style={s.heroTitle}>Tap to scan</Text>
            <Text style={s.heroSub}>Read &amp; categorized entirely on your phone — nothing uploaded.</Text>
          </Pressable>

          {/* No accessibilityLabel on the container: the Text below IS the
              label, and a second one there read a different sentence in the
              exhausted state than the screen actually showed. */}
          {meter && (
            <View style={s.meter}>
              <View style={s.meterTrack}>
                <View
                  style={[
                    s.meterFill,
                    { width: `${Math.round(meter.fill * 100)}%` },
                    meter.exhausted && { backgroundColor: T.danger },
                  ]}
                />
              </View>
              <Text style={[s.meterText, meter.exhausted && { color: T.danger }]}>
                {meter.exhausted ? 'No free scans left this month — Pro is unlimited' : meter.label}
              </Text>
            </View>
          )}

          <Pressable style={s.linkBtn} onPress={() => startScan(true)}>
            <Text style={s.linkBtnText}>Choose from photo library</Text>
          </Pressable>

          {recents.length > 0 && (
            <View style={s.recents}>
              <View style={s.recentsHead}>
                <Text style={s.recentsTitle}>Recent</Text>
                <Pressable onPress={() => onSeeAll()} hitSlop={8}>
                  <Text style={s.recentsAll}>See all</Text>
                </Pressable>
              </View>
              {recents.map((r) => (
                <Pressable key={r.id} style={s.recentRow} onPress={() => onSeeAll(r.id)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.recentMerchant} numberOfLines={1}>
                      {r.merchant || 'Unnamed receipt'}
                    </Text>
                    <Text style={s.recentMeta} numberOfLines={1}>
                      {r.date} · {r.category}
                    </Text>
                  </View>
                  <Text style={s.recentAmt}>${r.total.toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={s.privacy}>
            <Text style={s.privacyText}>
              <Text style={{ color: T.text, fontWeight: '600' }}>Your data never leaves this device. </Text>
              OCR runs on-device (Apple Vision) and receipts are stored locally — no upload, no account.
            </Text>
          </View>
        </>
      )}

      {busy && (
        <View style={s.progress}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={s.progressLabel}>Reading receipt (on-device OCR)…</Text>
        </View>
      )}

      {pending && !busy && (
        <>
          {/* Snapped photo stays pinned at top until Save or Discard */}
          <ZoomableImage uri={pending.imagePath} style={s.pinned} />
          <View style={s.review}>
            <Text style={s.h3}>Check the details</Text>
            <Text style={[s.conf, pending.merchantRemembered && { color: T.good }]}>
              {pending.merchantRemembered
                ? `★ Merchant remembered from a previous visit`
                : pending.category === 'Uncategorized'
                ? '⚠️ Couldn’t auto-categorize — please pick a category'
                : `Auto-categorized as “${pending.category}” (${pending.confidence} confidence)`}
            </Text>

            <Text style={s.label}>MERCHANT</Text>
            <TextInput style={s.input} value={pending.merchant}
              onChangeText={(v) => setPending({ ...pending, merchant: v })} placeholder="Merchant name" placeholderTextColor={T.muted2} />

            <View style={s.row3}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.label}>DATE</Text>
                <TextInput style={s.input} value={pending.date}
                  onChangeText={(v) => setPending({ ...pending, date: v })} placeholder="YYYY-MM-DD" placeholderTextColor={T.muted2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TOTAL ($)</Text>
                <TextInput style={s.input} value={pending.total} keyboardType="decimal-pad"
                  onChangeText={(v) => setPending({ ...pending, total: v })} placeholder="0.00" placeholderTextColor={T.muted2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>SALES TAX ($)</Text>
                <TextInput style={s.input} value={pending.salesTax} keyboardType="decimal-pad"
                  onChangeText={(v) => setPending({ ...pending, salesTax: v })} placeholder="0.00" placeholderTextColor={T.muted2} />
              </View>
            </View>
            <Text style={s.hint}>Tax rate: {pending.taxRate ? `${(pending.taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%` : '—'} ({pending.rateSource})</Text>

            <Text style={s.label}>MAIN TAX CATEGORY</Text>
            <Pressable style={s.input} onPress={() => setShowCats(!showCats)}>
              <Text style={{ color: T.text }}>{pending.category} ▾</Text>
            </Pressable>
            <CategoryPicker
              visible={showCats}
              categories={CATEGORY_NAMES}
              lineFor={SC_BY_NAME}
              selected={pending.category}
              title="Main tax category"
              onSelect={(name) => setPending({ ...pending, category: name })}
              onClose={() => setShowCats(false)}
            />
            <Text style={s.hint}>{SC_BY_NAME[pending.category] || ''}</Text>

            {/* Splits */}
            <Pressable onPress={() => setShowSplits(!showSplits)}>
              <Text style={[s.label, { color: T.accent, marginTop: 14 }]}>
                {showSplits ? 'HIDE SPLITS ▴' : `SPLIT THIS RECEIPT ▾${allocs.length ? ` (${allocs.length})` : ''}`}
              </Text>
            </Pressable>
            {showSplits && (
              <View style={s.splitBox}>
                {allocs.map((a, i) => (
                  <View key={i} style={s.allocRow}>
                    <Text style={{ color: T.text, flex: 1, fontSize: 13 }} numberOfLines={1}>{a.category}</Text>
                    <Text style={{ color: T.muted, fontSize: 13 }}>
                      ${a.amount.toFixed(2)}{a.tax ? ` ($${a.base?.toFixed(2)} + $${a.tax.toFixed(2)} tax)` : ''}
                    </Text>
                    <Pressable onPress={() => setAllocs(allocs.filter((_, j) => j !== i))}>
                      <Text style={{ color: T.danger, paddingLeft: 10 }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={s.input} onPress={() => setShowSplitCats(!showSplitCats)}>
                  <Text style={{ color: T.text, fontSize: 13 }}>{splitCat} ▾</Text>
                </Pressable>
                <CategoryPicker
                  visible={showSplitCats}
                  categories={CATEGORY_NAMES}
                  lineFor={SC_BY_NAME}
                  selected={splitCat}
                  title="Split category"
                  onSelect={setSplitCat}
                  onClose={() => setShowSplitCats(false)}
                />
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput style={[s.input, { flex: 1 }]} value={splitAmt} keyboardType="decimal-pad"
                    onChangeText={setSplitAmt} placeholder="Amount $" placeholderTextColor={T.muted2} />
                  <Pressable onPress={() => setSplitTax(!splitTax)} style={s.taxToggle}>
                    <Text style={{ color: splitTax ? T.accent : T.muted2, fontSize: 13 }}>{splitTax ? '☑' : '☐'} + tax</Text>
                  </Pressable>
                </View>
                {splitPreview && <Text style={s.hint}>{splitPreview}</Text>}
                <Pressable style={s.ghostBtn} onPress={addSplit}>
                  <Text style={{ color: T.text, fontWeight: '600' }}>+ Add split</Text>
                </Pressable>
                {allocs.length > 0 && (
                  <Text style={s.hint}>
                    Remainder ${(Math.round((totalNum - allocated) * 100) / 100).toFixed(2)} stays
                    under “{pending.category}”.
                  </Text>
                )}
              </View>
            )}

            <Text style={s.label}>NOTES</Text>
            <TextInput style={[s.input, { minHeight: 60 }]} value={notes} onChangeText={setNotes} multiline
              placeholder="e.g. Materials for the Nakamura job" placeholderTextColor={T.muted2} />

            <Pressable onPress={() => setShowRaw(!showRaw)}>
              <Text style={[s.label, { color: T.accent, marginTop: 12 }]}>{showRaw ? 'HIDE RAW TEXT ▴' : 'SHOW RAW SCANNED TEXT ▾'}</Text>
            </Pressable>
            {showRaw && (
              <View style={s.rawBox}>
                <Pressable style={s.copyBtn}
                  onPress={async () => { await Clipboard.setStringAsync(pending.ocrText); Alert.alert('Copied'); }}>
                  <Text style={{ color: T.accent, fontSize: 12 }}>Copy</Text>
                </Pressable>
                <Text style={s.rawText}>{pending.ocrText || '(no text found)'}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable style={[s.ghostBtn, { flex: 1 }]} onPress={discard}>
                <Text style={{ color: T.text, fontWeight: '600' }}>Discard</Text>
              </Pressable>
              <Pressable style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={save}>
                <Text style={s.primaryBtnText}>Save Receipt</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = styled((T) => ({
  wrap: { flex: 1, paddingHorizontal: 16 },
  // The dashed border is doing real work: it reads as "put something here"
  // rather than as a card that happens to be tappable.
  hero: {
    marginTop: 14, backgroundColor: T.card, borderColor: T.accent, borderWidth: 2,
    borderStyle: 'dashed', borderRadius: T.radiusLg, alignItems: 'center',
    paddingVertical: 56, paddingHorizontal: 24, gap: 10,
  },
  heroPressed: { opacity: 0.7 },
  heroTitle: { color: T.text, fontSize: 22, fontWeight: '700' },
  heroSub: { color: T.muted, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 19 },

  meter: { marginTop: 12, gap: 6 },
  meterTrack: { height: 4, borderRadius: 2, backgroundColor: T.line, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2, backgroundColor: T.accent },
  meterText: { color: T.muted, fontSize: 12, textAlign: 'center' },

  recents: {
    marginTop: 16, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, paddingHorizontal: 14, paddingVertical: 4,
  },
  recentsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, paddingBottom: 6,
  },
  recentsTitle: { color: T.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  recentsAll: { color: T.accent, fontSize: 12.5, fontWeight: '600' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9, borderTopColor: T.line, borderTopWidth: 1,
  },
  recentMerchant: { color: T.text, fontSize: 14, fontWeight: '600' },
  recentMeta: { color: T.muted, fontSize: 11.5, marginTop: 2 },
  recentAmt: { color: T.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Still used by "Save Receipt" in the review form. The capture hero no
  // longer uses it — there the rectangle is the button.
  primaryBtn: {
    marginTop: 14, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', shadowColor: T.accent, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkBtnText: { color: T.muted, fontSize: 13 },
  privacy: {
    marginTop: 18, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 14,
  },
  privacyText: { color: T.muted, fontSize: 12.5, lineHeight: 19 },
  progress: { marginTop: 40, alignItems: 'center', gap: 14 },
  progressLabel: { color: T.muted, fontSize: 13 },
  pinned: {
    marginTop: 10, width: '100%', height: 170, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  review: {
    marginTop: 12, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 16, marginBottom: 20,
  },
  h3: { color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  conf: { color: T.muted, fontSize: 12.5, marginBottom: 12 },
  label: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, marginTop: 12, marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  row3: { flexDirection: 'row', gap: 8 },
  hint: { color: T.muted2, fontSize: 12, marginTop: 6 },
  splitBox: { backgroundColor: T.bg2, borderRadius: 10, padding: 10, gap: 8, borderColor: T.line, borderWidth: 1 },
  allocRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  taxToggle: { paddingHorizontal: 10, paddingVertical: 10 },
  ghostBtn: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  rawBox: { backgroundColor: T.bg2, borderRadius: 10, padding: 10, borderColor: T.line, borderWidth: 1 },
  copyBtn: { alignSelf: 'flex-end', padding: 4 },
  rawText: { color: T.muted, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
}));
