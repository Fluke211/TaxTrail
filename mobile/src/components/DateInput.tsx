// A date field that stores ISO whatever order it was typed in.
//
// The field was a plain TextInput bound straight to the stored string, so
// "7-25-2026" was stored verbatim and the receipt then vanished from every
// per-year export, sorted to the top of the list, and matched no year filter —
// all without a word to the user. See src/lib/dateInput.js for the rules and
// for what each of those failures was.
//
// Same shape as MoneyInput: hold the raw text while focused so a half-typed
// date is not rewritten under the cursor, and settle it on blur.
import React, { useState } from 'react';
import { StyleProp, TextInput, TextStyle } from 'react-native';
const D = require('../lib/dateInput.js');

export default function DateInput({
  value,
  onChangeText,
  style,
  placeholderTextColor,
}: {
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
}) {
  // null means "not being edited" — show what the receipt actually holds.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <TextInput
      style={style}
      // Digits with "-", "/" and "." on the same keyboard. The default
      // keyboard put a date behind a keyboard switch every single time.
      keyboardType="numbers-and-punctuation"
      autoCorrect={false}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={placeholderTextColor}
      value={draft !== null ? draft : value}
      // Deliberately NOT reported per keystroke. Half a date is not a date,
      // and pushing it to the parent makes the warning below flash on every
      // character typed.
      onChangeText={setDraft}
      onBlur={() => {
        if (draft !== null) {
          const normalized = D.normalizeDateInput(draft);
          // An unreadable date is handed back as typed rather than discarded.
          // The caller shows it as wrong and refuses to save it, which is far
          // better than silently keeping the old value under new text.
          onChangeText(normalized || draft.trim());
        }
        setDraft(null);
      }}
    />
  );
}
