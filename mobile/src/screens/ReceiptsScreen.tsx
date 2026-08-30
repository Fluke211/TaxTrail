// Receipts list + detail modal (image, fields, edit, delete, raw-text copy).
import React, { useCallback, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { T } from '../lib/theme';
import MoneyInput from '../components/MoneyInput';
import { ZoomableImage } from '../components/ZoomableImage';
import { CategoryPicker } from '../components/CategoryPicker';
import SwipeableRow from '../components/SwipeableRow';
import FeedbackComposer from '../components/FeedbackComposer';
import { deleteReceipt, updateReceipt, type Receipt } from '../lib/db';
import { deleteReceiptFiles } from '../lib/ocr';
import { SC_BY_NAME, allocationsOf } from '../lib/rows';

const CATEGORY_NAMES: string[] = (require('../lib/classifier.js').CATEGORIES as { name: string }[]).map((c) => c.name);

export default function ReceiptsScreen({ receipts, onChanged }: { receipts: Receipt[]; onChanged: () => void }) {
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [showCats, setShowCats] = useState(false);
  // The receipt being reported, or null. Held separately from `selected` so the
  // detail modal stays open behind it and comes back if the user cancels.
  const [reporting, setReporting] = useState<Receipt | null>(null);

  /**
   * `onCancel` re-closes the swipeable when the user backs out. Without it the
   * row stays open behind the dismissed alert, looking like the delete is still
   * pending. The detail modal passes nothing, because it has no row to close.
   */
  const remove = useCallback((r: Receipt, onCancel?: () => void) => {
    Alert.alert('Delete receipt?', `${r.merchant} — $${r.total.toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
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

  const saveEdits = useCallback(async () => {
    if (!selected) return;
    await updateReceipt(selected);
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
            No receipts yet — scan your first one on the Capture tab.
          </Text>
        }
        renderItem={({ item }) => {
          const allocs = allocationsOf(item);
          return (
            <SwipeableRow onDelete={(close) => remove(item, close)}>
              <Pressable style={s.card} onPress={() => setSelected({ ...item })}>
                {item.thumbPath
                  ? <Image source={{ uri: item.thumbPath }} style={s.thumb} />
                  : <View style={[s.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Text>🧾</Text></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardM} numberOfLines={1}>{item.merchant}</Text>
                  <Text style={s.cardSub} numberOfLines={1}>
                    {item.date} · {item.category}{allocs.length > 1 ? ` +${allocs.length - 1} splits` : ''}
                  </Text>
                </View>
                <Text style={s.cardAmt}>${item.total.toFixed(2)}</Text>
              </Pressable>
            </SwipeableRow>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ScrollView style={s.detail} contentContainerStyle={{ padding: 16, paddingBottom: 80, paddingTop: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.detailTitle} numberOfLines={1}>{selected.merchant}</Text>
              <Pressable onPress={() => setSelected(null)} style={{ padding: 8 }}>
                <Text style={{ color: T.muted, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
            {selected.imagePath && (
              <ZoomableImage uri={selected.imagePath} style={s.detailImg} />
            )}
            <Text style={s.label}>MERCHANT</Text>
            <TextInput style={s.input} value={selected.merchant}
              onChangeText={(v) => setSelected({ ...selected, merchant: v })} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.label}>DATE</Text>
                <TextInput style={s.input} value={selected.date}
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
                  <Text key={i} style={{ color: T.muted, fontSize: 13, marginBottom: 2 }}>
                    · {a.category}: ${a.amount.toFixed(2)}{a.tax ? ` ($${a.base?.toFixed(2)} + $${a.tax.toFixed(2)} tax)` : ''}
                  </Text>
                ))}
              </>
            )}
            <Text style={s.label}>NOTES</Text>
            <TextInput style={[s.input, { minHeight: 50 }]} multiline value={selected.notes}
              onChangeText={(v) => setSelected({ ...selected, notes: v })} />

            <Pressable style={{ marginTop: 14 }}
              onPress={async () => { await Clipboard.setStringAsync(selected.ocrText || ''); Alert.alert('Raw text copied'); }}>
              <Text style={{ color: T.accent, fontSize: 12, fontWeight: '600' }}>COPY RAW SCANNED TEXT</Text>
            </Pressable>

            {/*
              Reporting from HERE rather than from Settings is what makes the
              report useful: it carries this one receipt's text and photo, which
              is the pair that fixes a parser bug — instead of every receipt on
              the device, most of which scanned fine.
            */}
            <Pressable style={{ marginTop: 12 }} onPress={() => setReporting(selected)}>
              <Text style={{ color: T.accent, fontSize: 12, fontWeight: '600' }}>REPORT A SCANNING PROBLEM</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable style={s.dangerBtn} onPress={() => remove(selected)}>
                <Text style={{ color: T.danger, fontWeight: '600' }}>Delete</Text>
              </Pressable>
              <Pressable style={s.primaryBtn} onPress={saveEdits}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save Changes</Text>
              </Pressable>
            </View>
          </ScrollView>
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

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 12, marginBottom: 10,
  },
  thumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: T.bg2 },
  cardM: { color: T.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: T.muted2, fontSize: 12, marginTop: 2 },
  cardAmt: { color: T.text, fontSize: 15, fontWeight: '700' },
  detail: { flex: 1, backgroundColor: T.bg },
  detailTitle: { color: T.text, fontSize: 18, fontWeight: '700', flex: 1 },
  detailImg: { width: '100%', height: 260, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: 10 },
  label: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, marginTop: 14, marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  hint: { color: T.muted2, fontSize: 12, marginTop: 6 },
  dangerBtn: {
    flex: 1, borderColor: 'rgba(255,107,107,0.45)', borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
