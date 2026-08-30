// Swipe a receipt left to reveal Delete.
//
// Tyler asked for this and said a dependency was fine if it made it feel right.
// It uses `ReanimatedSwipeable`, which is gesture-handler's own implementation
// on the UI thread via reanimated — the row tracks the finger at 120Hz instead
// of going through the JS bridge for every frame, which is the whole difference
// between "native" and "a list that lags". Both modules went into build 4 for
// this (D-053), so nothing new is needed to ship it.
//
// Imported from the `react-native-gesture-handler/ReanimatedSwipeable` subpath:
// it is NOT re-exported from the package root (the root exports the older
// `Swipeable`), and the subpath was verified to resolve before this was written.
import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { T } from '../lib/theme';

export default function SwipeableRow({ children, onDelete }: {
  children: React.ReactNode;
  /** Called when the user taps Delete. Do the confirming here — see below. */
  onDelete: (close: () => void) => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const close = useCallback(() => ref.current?.close(), []);

  /*
   * Reveal, tap, then confirm.
   *
   * iOS Mail deletes on swipe with an Undo, and that is the nicer interaction —
   * but undo is not available to us. `deleteReceiptFiles` removes the JPEGs, and
   * a receipt image is the substantiation for a deduction; there is no server
   * copy to restore from, by design. Photos confirms for the same reason, and
   * this follows Photos rather than Mail.
   *
   * The confirmation names the merchant and the amount, so it informs rather
   * than merely obstructs.
   */
  const press = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(close);
  }, [onDelete, close]);

  const renderRight = useCallback(() => (
    <Pressable onPress={press} style={s.action} accessibilityLabel="Delete receipt">
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={s.actionText}>Delete</Text>
    </Pressable>
  ), [press]);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      // How far the row must travel before it stays open on release. The default
      // is half the action width, which on a narrow action opens on almost any
      // horizontal movement — including the diagonal drift of a vertical scroll.
      rightThreshold={40}
      // No rubber-band past the action. Overshoot on a destructive control makes
      // it look like a further swipe will delete, and here it would not.
      overshootRight={false}
      renderRightActions={renderRight}
    >
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const s = StyleSheet.create({
  action: {
    backgroundColor: T.danger,
    justifyContent: 'center', alignItems: 'center',
    // marginBottom and borderRadius mirror `s.card` in ReceiptsScreen so the
    // action lines up with the row it belongs to rather than with the gap
    // beneath it.
    width: 88, marginBottom: 10, borderRadius: T.radius, gap: 3,
  },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
