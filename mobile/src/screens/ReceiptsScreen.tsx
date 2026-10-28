// Receipts list + detail modal (image, fields, edit, delete, raw-text copy).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { styled, useTheme } from '../lib/theme';
import MoneyInput from '../components/MoneyInput';
import DateInput from '../components/DateInput';
import { resolveImage } from '../lib/images';
import { ZoomableImage } from '../components/ZoomableImage';
import { CategoryPicker } from '../components/CategoryPicker';
import FeedbackComposer, { isFeedbackAvailable } from '../components/FeedbackComposer';
import { deleteReceipt, updateReceipt, type Receipt } from '../lib/db';
import { deleteReceiptFiles } from '../lib/ocr';
import { SC_BY_NAME, allocationsOf } from '../lib/rows';
const DI = require('../lib/dateInput.js');

const CATEGORY_NAMES: string[] = (require('../lib/classifier.js').CATEGORIES as { name: string }[]).map((c) => c.name);

export default function ReceiptsScreen({ receipts, onChanged, openId, onOpened }: {
  receipts: Receipt[];
  onChanged: () => void;
  /** A receipt to open on arrival — set when the Capture tab's Recent list is tapped. */
  openId?: number | null;
  /** Called once the request has been honoured, so it cannot re-fire. */
  onOpened?: () => void;
}) {
  const T = useTheme();
  const s = makeStyles(T);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [showCats, setShowCats] = useState(false);
  // The receipt being reported, or null. Held separately from `selected` so the
  // detail modal stays open behind it and comes back if the user cancels.
  const [reporting, setReporting] = useState<Receipt | null>(null);

  // Arriving from the Capture tab's Recent list with a receipt to open. Cleared
  // through onOpened so dismissing the modal does not immediately reopen it.
  useEffect(() => {
    if (openId == null) return;
    const found = receipts.find((r) => r.id === openId);
    if (found) setSelected({ ...found });
    onOpened?.();
  }, [openId, receipts, onOpened]);

  const remove = useCallback((r: Receipt) => {
    Alert.alert('Delete receipt?', `${r.merchant} · $${r.total.toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (r.id != null) await deleteReceipt(r.id);
          await deleteReceiptFiles(r);
          setSelected(null);
          onChanged();
        },
      },
    ]);
  }, [onChanged]);

  // Resolved once, and the render branches on the result: a row can hold a path
  // this launch cannot open.
  const detailUri = selected ? resolveImage(selected.imagePath) : null;

  const saveEdits = useCallback(async () => {
    if (!selected) return;
    /*
     * Normalize once more here, not only on the field's blur.
     * Tapping Save does blur the input first, but a save that arrives any
     * other way must not be the one path that writes a non-ISO date, because
     * nothing downstream would report it.
     */
    const iso = DI.normalizeDateInput(selected.date);
    if (!iso) {
      Alert.alert(
        'That date cannot be read',
        `"${selected.date}" is not a date. Type it as 7/25/2026 or 2026-07-25.`,
      );
      return;
    }
    await updateReceipt({ ...selected, date: iso });
    setSelected(null);
    onChanged();
  }, [selected, onChanged]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={receipts}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={
          <Text style={{ color: T.muted, textAlign: 'center', marginTop: 60 }}>
            No receipts yet. Scan your first one on the Capture tab.
          </Text>
        }
        renderItem={({ item }) => {
          const allocs = allocationsOf(item);
          // Branch on the RESOLVED path, not the stored one: a row can hold a
          // path this launch cannot open, and the placeholder is the honest
          // answer to that.
          const thumb = resolveImage(item.thumbPath);
          return (
            <Pressable style={s.card} onPress={() => setSelected({ ...item })}>
              {thumb
                ? <Image source={{ uri: thumb }} style={s.thumb} />
                : <View style={[s.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Text>🧾</Text></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardM} numberOfLines={1}>{item.merchant}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {item.date} · {item.category}{allocs.length > 1 ? ` +${allocs.length - 1} splits` : ''}
                </Text>
              </View>
              <Text style={s.cardAmt}>${item.total.toFixed(2)}</Text>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          /*
            Delete and Save Changes sit OUTSIDE the scroll area.
            They were the last thing in a long scrolling form, so finishing an
            edit meant scrolling to find the button that finishes it. Trimming
            the form would have fixed this one receipt and broken again on the
            next one with three splits and a note, because the form has no
            fixed height. A footer has one.
          */
          <View style={s.detail}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, paddingTop: 60 }}
            // Keeps the focused field above the keyboard. The ScrollView's own
            // inset, not a KeyboardAvoidingView: padding behaviour around a
            // ScrollView does not work (D-092).
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.detailTitle} numberOfLines={1}>{selected.merchant}</Text>
              <Pressable onPress={() => setSelected(null)} style={{ padding: 8 }}>
                <Text style={{ color: T.muted, fontSize: 24 }}>✕</Text>
              </Pressable>
            </View>
            {detailUri && <ZoomableImage uri={detailUri} style={s.detailImg} />}
            <Text style={s.label}>MERCHANT</Text>
            <TextInput style={s.input} value={selected.merchant}
              onChangeText={(v) => setSelected({ ...selected, merchant: v })} />
            {/* alignItems, because "SALES TAX ($)" wraps to two lines in a
                third of the screen and the default stretch then dropped its
                box a line below the other two. */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.label}>DATE</Text>
                <DateInput
                  style={[s.input, !DI.isIsoDay(selected.date) && s.inputBad]}
                  placeholderTextColor={T.muted}
                  value={selected.date}
                  onChangeText={(v) => setSelected({ ...selected, date: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TOTAL ($)</Text>
                <MoneyInput style={s.input} value={selected.total}
                  onChangeValue={(v) => setSelected({ ...selected, total: v ?? 0 })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>SALES TAX ($)</Text>
                <MoneyInput style={s.input} value={selected.salesTax}
                  onChangeValue={(v) => setSelected({ ...selected, salesTax: v })} />
              </View>
            </View>
            {/*
              An unreadable date is said out loud rather than stored quietly.
              Everything downstream assumes ISO: a date in any other shape drops
              the receipt out of every per-year export and sorts it to the top
              of the list, and all of that happens without a symptom (D-100).
            */}
            {!DI.isIsoDay(selected.date) && (
              <Text style={s.badHint}>
                That date cannot be read. Type it as 7/25/2026 or 2026-07-25.
              </Text>
            )}
            {/* The only way to turn a receipt into a credit by hand: the money
                fields are decimal-pads and iOS gives them no minus key. Flips
                the sales tax with the total, because a return takes the tax
                back out too. */}
            <Pressable
              hitSlop={10}
              style={s.refundToggle}
              onPress={() => setSelected({
                ...selected,
                total: -selected.total,
                salesTax: selected.salesTax == null ? null : -selected.salesTax,
              })}
            >
              <Text style={[s.refundLabel, selected.total < 0 && { color: T.danger, fontWeight: '700' }]}>
                {selected.total < 0 ? '☑' : '☐'} Refund (negative amount)
              </Text>
            </Pressable>
            <Text style={s.label}>MAIN TAX CATEGORY</Text>
            <Pressable style={s.input} onPress={() => setShowCats(!showCats)}>
              <Text style={{ color: T.text }}>{selected.category} ▾</Text>
            </Pressable>
            <CategoryPicker
              visible={showCats}
              categories={CATEGORY_NAMES}
              lineFor={SC_BY_NAME}
              selected={selected.category}
              title="Main tax category"
              onSelect={(name) => setSelected({ ...selected, category: name, scheduleC: SC_BY_NAME[name] || '' })}
              onClose={() => setShowCats(false)}
            />
            <Text style={s.hint}>{SC_BY_NAME[selected.category] || ''}</Text>
            {allocationsOf(selected).length > 1 && (
              <>
                <Text style={s.label}>SPLITS</Text>
                {allocationsOf(selected).map((a, i) => (
                  <Text key={i} style={{ color: T.muted, fontSize: T.fs.md, marginBottom: 2 }}>
                    · {a.category}: ${a.amount.toFixed(2)}{a.tax ? ` ($${a.base?.toFixed(2)} + $${a.tax.toFixed(2)} tax)` : ''}
                  </Text>
                ))}
              </>
            )}
            <Text style={s.label}>NOTES</Text>
            <TextInput style={[s.input, { minHeight: 50 }]} multiline value={selected.notes}
              onChangeText={(v) => setSelected({ ...selected, notes: v })} />

            {/*
              Both links on ONE row, and both labels short enough to sit there.
              Stacked full-width they pushed Delete and Save Changes off the
              bottom of the screen, so saving an edit meant scrolling to find
              the button that finishes the job.

              Reporting from HERE rather than from Settings is what makes the
              report useful: it carries this one receipt's text and photo, which
              is the pair that fixes a parser bug, instead of every receipt on
              the device, most of which scanned fine.
            */}
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
              <Pressable hitSlop={8}
                onPress={async () => { await Clipboard.setStringAsync(selected.ocrText || ''); Alert.alert('Raw text copied'); }}>
                <Text style={s.linkSm}>COPY RAW TEXT</Text>
              </Pressable>
              {isFeedbackAvailable() && (
                <Pressable hitSlop={8} onPress={() => setReporting(selected)}>
                  <Text style={s.linkSm}>REPORT A PROBLEM</Text>
                </Pressable>
              )}
            </View>

          </ScrollView>
          <View style={s.actionBar}>
            <Pressable style={s.dangerBtn} onPress={() => remove(selected)}>
              <Text style={{ color: T.danger, fontWeight: '600' }}>Delete</Text>
            </Pressable>
            <Pressable style={s.primaryBtn} onPress={saveEdits}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Save Changes</Text>
            </Pressable>
          </View>
          </View>
        )}
      </Modal>

      <FeedbackComposer
        visible={reporting != null}
        receipts={reporting ? [reporting] : []}
        kind="scan"
        onClose={() => setReporting(null)}
      />
    </View>
  );
}

const makeStyles = styled((T) => ({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 12, marginBottom: 10,
  },
  thumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: T.bg2 },
  cardM: { color: T.text, fontSize: T.fs.body, fontWeight: '600' },
  cardSub: { color: T.muted2, fontSize: T.fs.sm, marginTop: 2 },
  cardAmt: { color: T.text, fontSize: T.fs.body, fontWeight: '700' },
  detail: { flex: 1, backgroundColor: T.bg },
  detailTitle: { color: T.text, fontSize: 20, fontWeight: '700', flex: 1 },
  detailImg: { width: '100%', height: 260, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: 10 },
  label: { color: T.muted2, fontSize: T.fs.xs, letterSpacing: 0.6, marginTop: 14, marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: T.fs.body,
  },
  hint: { color: T.muted2, fontSize: T.fs.sm, marginTop: 6 },
  // A date the app cannot read is shown as wrong, in the same red the Delete
  // control uses, rather than looking like any other filled-in field.
  inputBad: { borderColor: T.dangerLine },
  badHint: { color: T.danger, fontSize: T.fs.sm, marginTop: 6, fontWeight: '600' },
  linkSm: { color: T.accent, fontSize: T.fs.sm, fontWeight: '600' },
  // Pinned below the scroll area. The bottom padding clears the home indicator.
  actionBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
    borderTopColor: T.line, borderTopWidth: 1, backgroundColor: T.bg,
  },
  refundToggle: { paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
  refundLabel: { color: T.muted2, fontSize: T.fs.sm, fontWeight: '600' },
  dangerBtn: {
    flex: 1, borderColor: T.dangerLine, borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
}));
