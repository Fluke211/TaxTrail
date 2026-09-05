/*
 * What stands between someone holding the phone and a year of receipts.
 *
 * Deliberately plain: a lock screen that offers choices is a lock screen with
 * ways around it. One control, and it re-prompts.
 *
 * It does NOT render the receipt list underneath, blurred or otherwise. The
 * merchant names and amounts are the private part, and a blur is a picture of
 * them.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from './Icon';
import { styled, useTheme } from '../lib/theme';

export function LockScreen({ onUnlock, busy }: { onUnlock: () => void; busy: boolean }) {
  const T = useTheme();
  const s = makeStyles(T);
  return (
    <View style={s.wrap}>
      <Icon name="lock-closed-outline" size={44} color={T.accent} />
      <Text style={s.brand}>
        Tax<Text style={{ color: T.accent }}>Trail</Text>
      </Text>
      <Text style={s.sub}>Your receipts are locked on this device.</Text>
      <Pressable
        style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
        onPress={onUnlock}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Unlock TaxTrail"
        accessibilityState={{ disabled: busy }}
      >
        <Text style={s.btnText}>{busy ? 'Unlocking…' : 'Unlock'}</Text>
      </Pressable>
      <Text style={s.note}>Face ID, Touch ID, or your passcode.</Text>
    </View>
  );
}

const makeStyles = styled((T) => ({
  wrap: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  brand: { color: T.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: T.muted, fontSize: T.fs.body, textAlign: 'center' },
  btn: {
    marginTop: 18, backgroundColor: T.accent, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  btnText: { color: '#fff', fontSize: T.fs.lg, fontWeight: '600' },
  note: { color: T.muted2, fontSize: T.fs.md, marginTop: 4 },
}));
