/*
 * TaxTrail — what a money field should show while somebody is still typing.
 *
 * The receipt edit fields were controlled inputs bound directly to a NUMBER:
 *
 *   value={String(selected.salesTax)}
 *   onChangeText={(v) => setSelected({ ...selected, salesTax: parseFloat(v) })}
 *
 * Every keystroke went text -> number -> text, and anything that is not yet a
 * finished number got erased on the way back:
 *
 *   type "0"    -> parseFloat("0") = 0, stored as null, renders ""   (0 vanishes)
 *   type "."    -> parseFloat(".") = NaN, stored as null, renders "" (dot vanishes)
 *   type "1."   -> parseFloat("1.") = 1, renders "1"                 (dot vanishes)
 *
 * So the decimal point could never be entered AT ALL — every edit was silently
 * integer-only. Tyler hit it trying to correct a sales tax to $0.40.
 *
 * The fix is to keep the user's raw text while the field is focused and only
 * fall back to the canonical number when they leave it. This module holds the
 * pure half so the rules are unit-testable rather than something you verify by
 * typing on a phone — same reasoning as gates.js and prorate.js (D-043).
 */
'use strict';

/**
 * Clean one keystroke's worth of text without destroying an in-progress entry.
 *
 * Deliberately permissive: "0", ".", "0." and "0.4" are all legal *states* on
 * the way to a number, and a field that erases them is unusable. Only input
 * that could never become money is dropped.
 */
function sanitizeMoneyText(raw) {
  var s = String(raw == null ? '' : raw);
  // Some keyboards and locales produce a comma for the decimal separator.
  s = s.replace(/,/g, '.');
  // Anything that is not a digit or a separator cannot be part of an amount.
  s = s.replace(/[^0-9.]/g, '');
  // Keep only the first separator; later ones are typos, not new decimals.
  var first = s.indexOf('.');
  if (first !== -1) {
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
  }
  // Money has two decimal places. Truncate rather than round: rounding while
  // the user is mid-keystroke changes digits they already typed.
  var dot = s.indexOf('.');
  if (dot !== -1 && s.length - dot - 1 > 2) s = s.slice(0, dot + 3);
  // Strip a run of leading zeros ("007" -> "7") but never the single zero that
  // makes "0.40" typable.
  s = s.replace(/^0+(?=[0-9])/, '');
  return s;
}

/**
 * The number a field's text currently represents, or null when it does not yet
 * represent one. "" , "." and "0." are all legitimately null — the user is
 * still typing, and null means "no value", not "zero".
 */
function moneyValue(text) {
  var s = sanitizeMoneyText(text);
  if (s === '' || s === '.') return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}

module.exports = { sanitizeMoneyText: sanitizeMoneyText, moneyValue: moneyValue };
