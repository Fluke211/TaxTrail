// Full-screen category picker.
//
// Replaces an inline dropdown that set maxHeight on a plain View — which in
// React Native does not clip or scroll its children, so all 29 categories
// rendered and painted over the notes field and the Save/Discard buttons.
//
// A modal is also the better shape here regardless of that bug: 29 options do
// not fit a cramped inline box, and a nested vertical ScrollView inside the
// form's own ScrollView fights it for gestures on iOS. Full height also means
// the keyboard is dismissed rather than competing for space.
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '../lib/theme';

interface Props {
  visible: boolean;
  categories: string[];
  /** name -> Schedule C line description */
  lineFor: Record<string, string>;
  selected: string;
  title?: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function CategoryPicker({
  visible, categories, lineFor, selected, title = 'Tax category', onSelect, onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.sheet}>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <FlatList
          data={categories}
          keyExtractor={(name) => name}
          initialNumToRender={30}
          renderItem={({ item }) => {
            const active = item === selected;
            return (
              <Pressable
                style={[s.row, active && s.rowActive]}
                onPress={() => { onSelect(item); onClose(); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={s.rowText}>
                  <Text style={[s.name, active && s.nameActive]}>{item}</Text>
                  {!!lineFor[item] && <Text style={s.line}>{lineFor[item]}</Text>}
                </View>
                {active && <Text style={s.check}>✓</Text>}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 14, paddingHorizontal: 18,
    borderBottomColor: T.line, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: T.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: T.accent, fontSize: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomColor: T.line, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowActive: { backgroundColor: T.bg2 },
  rowText: { flex: 1 },
  name: { color: T.text, fontSize: 15 },
  nameActive: { color: T.accent, fontWeight: '600' },
  line: { color: T.muted2, fontSize: 11, marginTop: 2 },
  check: { color: T.accent, fontSize: 17, fontWeight: '700', marginLeft: 12 },
});
