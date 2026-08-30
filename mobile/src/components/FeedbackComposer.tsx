/*
 * Send feedback, with the user choosing exactly what goes with it.
 *
 * The privacy reasoning is in `src/lib/feedback.js` and D-059, and it decides
 * the shape of this screen: every attachment is off until ticked, each is named
 * in plain words, and the final Send happens in Apple's own Mail composer where
 * the user sees their own address, the body, and every attachment before it
 * goes. That is what keeps the "Data Not Collected" label true.
 *
 * The one thing this must never do is attach something the user did not tick.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { styled, useTheme } from '../lib/theme';
import type { Receipt } from '../lib/db';
import { writeDiagnosticsFile } from '../lib/exportShare';
import { versionStamp } from '../lib/version';
const F = require('../lib/feedback.js');

const SUPPORT_EMAIL = 'support@taxtrail.app';

/*
 * expo-mail-composer is reached through a guarded require, never a static
 * import.
 *
 * An `eas update` reaches every binary sharing this runtimeVersion, and
 * build 3 was compiled without this module. A static `import` is evaluated at
 * module load, so on build 3 it would throw before any app code ran — and
 * expo-updates has nothing to fall back to on a fresh install, which makes that
 * crash terminal (D-062). Build 4 died of exactly this shape of mistake.
 *
 * Same pattern as `isRestoreAvailable()` in exportShare.ts: ask, do not assume,
 * and hide the control rather than offering one that cannot work.
 */
function mailComposer(): any | null {
  try {
    const m = require('expo-mail-composer');
    return typeof m?.composeAsync === 'function' ? m : null;
  } catch {
    return null;
  }
}

/** Whether this binary can compose mail at all. The caller hides the entry
 *  point when it cannot, so nobody taps a button that dead-ends. */
export function isFeedbackAvailable(): boolean {
  return mailComposer() != null;
}

export default function FeedbackComposer({ visible, receipts, kind, onClose }: {
  visible: boolean;
  receipts: Receipt[];
  /** 'scan' when reporting a specific receipt, 'general' from Settings. */
  kind: 'scan' | 'general';
  onClose: () => void;
}) {
  const T = useTheme();
  const s = makeStyles(T);
  const [message, setMessage] = useState('');
  const [withDiagnostics, setWithDiagnostics] = useState(false);
  const [withImages, setWithImages] = useState(false);
  const [sending, setSending] = useState(false);

  const imageCount = useMemo(
    () => receipts.filter((r) => r.imagePath).length,
    [receipts],
  );

  const reset = useCallback(() => {
    setMessage(''); setWithDiagnostics(false); setWithImages(false);
    onClose();
  }, [onClose]);

  const send = useCallback(async () => {
    setSending(true);
    try {
      const MailComposer = mailComposer();
      if (!MailComposer) {
        Alert.alert(
          'Not available in this version',
          `This build of TaxTrail cannot open the Mail composer. Write to ${SUPPORT_EMAIL} instead.`,
        );
        return;
      }
      if (!(await MailComposer.isAvailableAsync())) {
        Alert.alert(
          'No mail account',
          `This device has no mail account set up. Write to ${SUPPORT_EMAIL} from wherever you read email.`,
        );
        return;
      }

      const attachments: string[] = [];
      if (withDiagnostics) attachments.push(await writeDiagnosticsFile(receipts));

      let attachedImages = 0;
      let skippedImages = 0;
      if (withImages) {
        // Sizes have to be read before choosing, because the cap is in bytes.
        const sized = await Promise.all(
          receipts.filter((r) => r.imagePath).map(async (r) => {
            try {
              const info = await FileSystem.getInfoAsync(r.imagePath as string);
              return { ...r, size: info.exists ? (info.size ?? 0) : 0 };
            } catch {
              return { ...r, size: 0 };
            }
          }),
        );
        const picked = F.selectImages(sized);
        for (const r of picked.chosen) attachments.push(r.imagePath as string);
        attachedImages = picked.chosen.length;
        skippedImages = picked.skipped;
      }

      const result = await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject: F.buildSubject(kind, versionStamp()),
        body: F.buildBody({
          message,
          version: versionStamp(),
          receiptCount: receipts.length,
          includeDiagnostics: withDiagnostics,
          includeImages: withImages,
          imageCount: attachedImages,
        }),
        attachments,
      });

      // Nothing has been sent yet at the point composeAsync returns on a
      // cancel — the composer is the last gate, and the user is allowed to
      // change their mind there. Only say something on a real send.
      if (result.status === 'sent') {
        Alert.alert(
          'Thank you',
          skippedImages > 0
            ? `Sent. ${skippedImages} image${skippedImages === 1 ? ' was' : 's were'} left out to keep the email under the size most mail providers accept.`
            : 'Sent.',
        );
        reset();
      } else {
        onClose();
      }
    } catch (e) {
      console.warn('feedback failed', e);
      Alert.alert('Could not open Mail', String(e));
    } finally {
      setSending(false);
    }
  }, [kind, message, receipts, withDiagnostics, withImages, reset, onClose]);

  const Check = ({ on, onToggle, label, detail }: {
    on: boolean; onToggle: () => void; label: string; detail: string;
  }) => (
    <Pressable style={s.check} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={22}
        color={on ? T.accent : T.muted2}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 14 }}>{label}</Text>
        <Text style={s.detail}>{detail}</Text>
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={s.sheet} contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.title}>
            {kind === 'scan' ? 'Report a scanning problem' : 'Send feedback'}
          </Text>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ color: T.muted, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        <Text style={s.label}>MESSAGE</Text>
        <TextInput
          style={s.input}
          multiline
          value={message}
          onChangeText={setMessage}
          placeholder={kind === 'scan'
            ? 'What did it get wrong, and what should it have been?'
            : 'What would you like to tell us?'}
          placeholderTextColor={T.muted2}
        />

        <Text style={s.label}>ATTACH (OPTIONAL)</Text>
        <Check
          on={withDiagnostics}
          onToggle={() => setWithDiagnostics(!withDiagnostics)}
          label={F.ATTACHMENT_LABELS.diagnostics}
          detail={`The text the scanner read from your ${receipts.length} receipt${receipts.length === 1 ? '' : 's'}, and what it made of it. This is what makes a parsing bug fixable. It includes merchant names and amounts.`}
        />
        <Check
          on={withImages}
          onToggle={() => setWithImages(!withImages)}
          label={F.ATTACHMENT_LABELS.images}
          detail={`${imageCount} photo${imageCount === 1 ? '' : 's'}. Only useful for a scanning problem — the picture usually shows why a receipt read badly when the text alone does not.`}
        />

        {/*
          Stated plainly, because the label depends on it being true. See D-059
          and Apple's optional-disclosure criteria.
        */}
        <Text style={s.privacy}>
          Nothing is attached unless you tick it, and nothing is sent until you
          tap Send in the Mail app — where you will see your own address, the
          message, and every attachment. TaxTrail has no servers and uploads
          nothing on its own.
        </Text>

        <Pressable
          style={[s.primary, (sending || !message.trim()) && { opacity: 0.5 }]}
          disabled={sending || !message.trim()}
          onPress={send}
        >
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue to Mail</Text>}
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const makeStyles = styled((T) => ({
  sheet: { flex: 1, backgroundColor: T.bg },
  title: { color: T.text, fontSize: 18, fontWeight: '700', flex: 1 },
  label: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, marginTop: 18, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, padding: 12, fontSize: 14, minHeight: 110, textAlignVertical: 'top',
  },
  check: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  detail: { color: T.muted2, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  privacy: { color: T.muted, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
  primary: {
    backgroundColor: T.accent, borderRadius: T.radius, padding: 15,
    alignItems: 'center', marginTop: 20,
  },
}));
