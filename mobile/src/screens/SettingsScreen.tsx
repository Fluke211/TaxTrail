// Settings: subscription, restore, about, developer options, and the one
// destructive control in the app.
//
// This tab exists mostly to get things OFF the Summary screen. Manage
// Subscription sat in the EXPORT card, between "Full JSON backup" and a note
// about QuickBooks date formats, which is not where anybody looks for it —
// Tyler said so directly. Export is a workflow; subscription, restore and
// deletion are settings, and mixing them made both harder to scan.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { styled, useTheme } from '../lib/theme';
import { deleteAllData, type Receipt } from '../lib/db';
import { manageSubscription, presentPaywall, restorePurchases } from '../lib/purchases';
import { exportBackup, exportDiagnostics, restoreArchive, isRestoreAvailable } from '../lib/exportShare';
import { versionStamp } from '../lib/version';
import FeedbackComposer, { isFeedbackAvailable } from '../components/FeedbackComposer';
const DM = require('../lib/devMode.js');

// Namespaced like the other stored keys (see memory.ts).
const DEV_MODE_KEY = 'rs.devMode.v1';

const SUPPORT_EMAIL = 'support@taxtrail.app';
const SITE = 'https://taxtrail.app';

export default function SettingsScreen({ receipts, pro, onChanged }: {
  receipts: Receipt[]; pro: boolean; onChanged: () => void;
}) {
  const T = useTheme();
  const s = makeStyles(T);
  const [busy, setBusy] = useState<string | null>(null);
  const [dev, setDev] = useState(false);
  const [tapState, setTapState] = useState({ count: 0, lastAt: 0 });
  const [hint, setHint] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'none' | 'error'>('idle');
  const [feedback, setFeedback] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEV_MODE_KEY).then((v) => setDev(v === '1')).catch(() => {});
  }, []);

  const run = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); }
    catch (e) { console.warn(e); Alert.alert('That did not work', String(e)); }
    finally { setBusy(null); }
  }, []);

  // Seven taps on the version stamp. The counting rules are in devMode.js so
  // "seven taps unlocks it" is a unit test rather than something you verify by
  // tapping a phone seven times.
  const tapVersion = useCallback(() => {
    if (dev) return;
    const next = DM.tap(tapState, Date.now());
    setTapState({ count: next.count, lastAt: next.lastAt });
    setHint(next.message);
    if (next.unlocked) {
      setDev(true);
      AsyncStorage.setItem(DEV_MODE_KEY, '1').catch(() => {});
    }
  }, [dev, tapState]);

  const disableDev = useCallback(() => {
    setDev(false);
    setHint(null);
    AsyncStorage.removeItem(DEV_MODE_KEY).catch(() => {});
  }, []);

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

  const canRestore = isRestoreAvailable();

  const runRestoreArchive = useCallback(() => {
    Alert.alert(
      'Restore from archive',
      'Pick a TaxTrail archive (.zip). Receipts it contains that are not already '
      + 'here will be added, with their images. Nothing is deleted or overwritten, '
      + 'and restoring the same archive twice changes nothing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          onPress: () => run('archive', async () => {
            const r = await restoreArchive();
            if (!r) return;
            onChanged();
            const parts = [`${r.imported} receipt${r.imported === 1 ? '' : 's'} added`];
            if (r.images) parts.push(`${r.images} image${r.images === 1 ? '' : 's'} restored`);
            if (r.skipped) parts.push(`${r.skipped} already here, skipped`);
            if (r.imagesMissing) parts.push(`${r.imagesMissing} image${r.imagesMissing === 1 ? '' : 's'} could not be read`);
            Alert.alert(r.imported ? 'Restored' : 'Nothing to add', parts.join('\n'));
          }),
        },
      ],
    );
  }, [run, onChanged]);

  /*
   * Delete everything. Two taps, and the second one names the number.
   *
   * The confirmation deliberately mentions the archive export, because that is
   * the difference between a user who meant it and a user about to lose a year
   * of tax records. Destructive and irreversible: there is no server-side copy
   * to recover from, by design.
   */
  const confirmDeleteAll = useCallback(() => {
    if (!receipts.length) {
      Alert.alert('Nothing to delete', 'There are no receipts on this device.');
      return;
    }
    const n = receipts.length;
    Alert.alert(
      `Delete all ${n} receipt${n === 1 ? '' : 's'}?`,
      'This removes every receipt and every photograph from this device. '
      + 'It cannot be undone — TaxTrail has no servers, so there is no copy to '
      + 'restore from.\n\n'
      + 'If you have not exported a receipt archive (.zip), cancel and do that first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            // A second confirmation, because the first one is the tap people
            // make while reading. Standard for anything irreversible.
            Alert.alert(
              'Last chance',
              `Permanently delete ${n} receipt${n === 1 ? '' : 's'} and all images?`,
              [
                { text: 'Keep my data', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => run('delete', async () => {
                    const res = await deleteAllData();
                    onChanged();
                    Alert.alert(
                      'Deleted',
                      `${res.receipts} receipt${res.receipts === 1 ? '' : 's'} removed`
                      + (res.imagesRemoved ? ', along with every image.' : '. Some image files could not be removed.'),
                    );
                  }),
                },
              ],
            );
          },
        },
      ],
    );
  }, [receipts.length, run, onChanged]);

  const Row = ({ label, onPress, k, tone }: {
    label: string; onPress: () => void; k?: string; tone?: 'normal' | 'accent' | 'danger';
  }) => (
    <Pressable style={s.row} disabled={busy != null} onPress={onPress}>
      {busy === k
        ? <ActivityIndicator color={T.accent} />
        : (
          <Text style={{
            color: tone === 'danger' ? T.danger : tone === 'accent' ? T.accent : T.text,
            fontSize: 14,
          }}>{label}</Text>
        )}
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={s.card}>
        <Text style={s.title}>SUBSCRIPTION</Text>
        <Text style={s.status}>{pro ? '★ TaxTrail Pro is active' : 'Free plan · 10 scans a month'}</Text>
        {pro
          ? <Row label="Manage subscription" tone="accent" onPress={() => { void manageSubscription(); }} />
          : <Row label="Upgrade to Pro" tone="accent" onPress={async () => { if (await presentPaywall()) onChanged(); }} />}
        {/*
          Apple requires a restore control for any app selling a subscription or
          non-consumable (Guideline 3.1.1). Until now the only one was inside the
          fallback paywall, which appears only when RevenueCat's remote template
          fails to load — so in the normal case there was none at all.
        */}
        <Row label="Restore purchases" k="restore"
          onPress={() => run('restore', async () => { await restorePurchases(); onChanged(); })} />
      </View>

      {canRestore && (
        <View style={s.card}>
          <Text style={s.title}>YOUR DATA</Text>
          <Row label="Restore from a receipt archive (.zip)" k="archive" onPress={runRestoreArchive} />
          <Text style={s.note}>
            Adds receipts an archive has and this device does not. Never deletes
            or overwrites anything.
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.title}>ABOUT</Text>
        {/*
          Goes through the composer rather than a bare mailto:, so the user can
          attach the diagnostics that make a parser bug fixable — and can see
          exactly what they are attaching. See D-059.
        */}
        {isFeedbackAvailable() && (
          <Row label="Send feedback" tone="accent" onPress={() => setFeedback(true)} />
        )}
        <Row label={`Email ${SUPPORT_EMAIL}`}
          onPress={() => { void Linking.openURL(`mailto:${SUPPORT_EMAIL}`); }} />
        <Row label="Privacy policy" tone="accent"
          onPress={() => { void Linking.openURL(`${SITE}/privacy`); }} />
        <Text style={s.note}>
          Every receipt is read and stored on this device. TaxTrail has no
          servers, no account, and nothing to upload.
        </Text>
      </View>

      {dev && (
        <View style={s.card}>
          <Text style={s.title}>DEVELOPER</Text>
          {/*
            Both of these are useful to Tyler and misleading to everyone else.
            The JSON backup records image PATHS, which go stale on reinstall —
            it looks like a backup and is not one; the archive export is. The
            diagnostics dump is raw OCR text, useful only to somebody fixing the
            parser. Hidden rather than removed, because they are how parser bugs
            get fixed at all (D-057).
          */}
          <Row label="Parser diagnostics (raw OCR text)" k="diag"
            onPress={() => run('diag', () => exportDiagnostics(receipts))} />
          <Row label="Full JSON backup (data only, no images)" k="backup"
            onPress={() => run('backup', () => exportBackup(receipts))} />
          <Row label={
            updateState === 'checking' ? 'Checking…'
              : updateState === 'none' ? 'Up to date · tap to check again'
              : updateState === 'error' ? 'Check failed · tap to retry'
              : 'Check for updates'
          } tone="accent" onPress={checkForUpdate} />
          <Row label="Turn off developer options" onPress={disableDev} />
          <Text style={s.note}>
            Channel {String(Updates.channel ?? 'none')} · runtime {String(Updates.runtimeVersion ?? '—')}
          </Text>
        </View>
      )}

      <View style={[s.card, { borderColor: T.dangerLine }]}>
        <Text style={[s.title, { color: T.danger }]}>DANGER ZONE</Text>
        <Row label="Delete all receipts and images" k="delete" tone="danger" onPress={confirmDeleteAll} />
        <Text style={s.note}>
          Irreversible. Export a receipt archive first if you might want any of
          it back.
        </Text>
      </View>

      <FeedbackComposer
        visible={feedback}
        receipts={receipts}
        kind="general"
        onClose={() => setFeedback(false)}
      />

      <Pressable onPress={tapVersion} hitSlop={10}>
        <Text style={s.version}>{versionStamp()}</Text>
      </Pressable>
      {hint && !dev && <Text style={[s.version, { color: T.muted }]}>{hint}</Text>}
      <Text style={s.version}>
        {receipts.length} receipt{receipts.length === 1 ? '' : 's'} · 100% on-device
      </Text>
    </ScrollView>
  );
}

const makeStyles = styled((T) => ({
  card: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 14, marginTop: 12,
  },
  title: { color: T.accent, fontSize: 11, letterSpacing: 0.8, fontWeight: '700', marginBottom: 8 },
  status: { color: T.muted, fontSize: 13, marginBottom: 10 },
  row: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
  },
  note: { color: T.muted2, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  version: { color: T.muted2, fontSize: 11, textAlign: 'center', marginTop: 14, letterSpacing: 0.3 },
}));
