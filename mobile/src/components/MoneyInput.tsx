// A money field that lets you finish typing.
//
// Holds the raw text while focused and reports the parsed number as it goes,
// falling back to the canonical value on blur. Binding a TextInput straight to
// a number round-trips text -> number -> text on every keystroke, which erases
// "0", "." and "1." — see src/lib/moneyInput.js for what that broke.
import React, { useState } from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
const M = require('../lib/moneyInput.js');

export default function MoneyInput({
  value,
  onChangeValue,
  style,
  placeholder = '0.00',
  placeholderTextColor,
}: {
  value: number | null;
  onChangeValue: (v: number | null) => void;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  placeholderTextColor?: string;
}) {
  // null means "not being edited" — show whatever the receipt actually holds.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : (value != null ? String(value) : '');

  return (
    <TextInput
      style={style}
      keyboardType="decimal-pad"
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      onChangeText={(t) => {
        const clean: string = M.sanitizeMoneyText(t);
        setDraft(clean);
        onChangeValue(M.moneyValue(clean));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
