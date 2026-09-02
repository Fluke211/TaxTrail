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
import { APP_BUILD, versionStamp } from '../lib/version';
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../lib/appearance';
import { isLockAvailable, isLockEnabled, setLockEnabled } from '../lib/appLockNative';
import Icon from '../components/Icon';
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
  const theme = useThemeChoice();
  const [lockOn, setLockOn] = useState<boolean | null>(null);
  const [lockAvailable, setLockAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(DEV_MODE_KEY)
      .then((v) => { if (alive) setDev(v === '1'); })
      .catch(() => {});
    Promise.all([isLockEnabled(), isLockAvailable()])
      .then(([on, can]) => { if (alive) { setLockOn(on); setLockAvailable(can); } })
      .catch(() => {});
    return () => { alive = false; };
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
    // Clears itself. Nothing else ever resets it, so it used to sit under the
    // version stamp for the rest of the visit, next to the card it announced.
    if (next.message) setTimeout(() => setHint(null), 4000);
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
      + 'It cannot be undone. TaxTrail has no servers, so there is no copy to '
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
        <Text style={s.title}>APPEARANCE</Text>
        <View style={s.segment}>
          {([
            ['system', 'System'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ] as [ThemeChoice, string][]).map(([value, label]) => {
            const on = theme === value;
            return (
              <Pressable
                key={value}
                style={[s.segmentBtn, on && s.segmentBtnOn]}
                onPress={() => { void setThemeChoice(value); }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
              >
                {/* The selected label is `text`, not `accent`: accent on
                    accentSoft over bg2 flattens to 4.10:1, under the AA bar
                    this project holds every other label to. The accent border
                    carries the selection instead, as SummaryScreen's chips do. */}
                <Text style={[s.segmentText, on && { color: T.text, fontWeight: '700' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.note}>
          {APP_BUILD >= 7
            ? "System follows your phone's Light or Dark setting."
            : "Light and Dark work now. System will follow your phone's setting"
              + ' after the next app update from the App Store.'}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.title}>PRIVACY</Text>
        <Pressable
          style={[s.row, s.toggleRow]}
          onPress={() => {
            if (!lockAvailable || lockOn == null) return;
            const next = !lockOn;
            setLockOn(next);
            void setLockEnabled(next);
          }}
          disabled={!lockAvailable || lockOn == null}
          accessibilityRole="switch"
          accessibilityLabel="Require Face ID to open TaxTrail"
          accessibilityState={{ checked: lockOn === true, disabled: !lockAvailable }}
        >
          <Text style={{ color: lockAvailable ? T.text : T.muted2, fontSize: 14, flex: 1 }}>
            Require Face ID to open
          </Text>
          <Icon
            name={lockOn && lockAvailable ? 'checkbox' : 'square-outline'}
            size={22}
            color={lockAvailable ? (lockOn ? T.accent : T.muted) : T.muted2}
          />
        </Pressable>
        <Text style={s.note}>
          {lockAvailable == null
            ? 'Checking what this phone can use.'
            : lockAvailable
              ? 'Face ID, Touch ID or your passcode is needed to open the app, and again after a minute away. Your receipts are on this device, so this is the only thing between them and whoever picks up your phone.'
              : 'Unavailable: this phone has no Face ID, Touch ID or passcode set, so there would be no way back in.'}
        </Text>
      </View>

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
            Channel {String(Updates.channel ?? 'none')} · runtime {String(Updates.runtimeVersion ?? 'unknown')}
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
      {/* No `!dev` guard: it batches with setDev(true), so the seventh tap's
          confirmation could never render. Nothing shows before the unlock now,
          so this line only ever carries the confirmation itself. */}
      {hint && <Text style={[s.version, { color: T.muted }]}>{hint}</Text>}
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
  // card2, not bg2: LIGHT.bg2 and LIGHT.card are both #ffffff, so an inset
  // drawn with bg2 vanishes into the card it sits on. card2 is the inset
  // colour in both palettes.
  segment: {
    flexDirection: 'row', gap: 6, backgroundColor: T.card2, borderRadius: 10,
    borderColor: T.line, borderWidth: 1, padding: 4,
  },
  segmentBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 7,
    borderColor: 'transparent', borderWidth: 1,
  },
  segmentBtnOn: { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  segmentText: { color: T.muted, fontSize: 13.5, fontWeight: '600' },
  // Composed with `row`, which has no flexDirection, so a label and a control
  // laid out with it alone stack vertically. Only the difference lives here.
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  version: { color: T.muted2, fontSize: 11, textAlign: 'center', marginTop: 14, letterSpacing: 0.3 },
}));
