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
  /*
   * A leading minus survives, because a total can be negative now.
   *
   * Refunds parse as negative (D-088), and this function used to strip the
   * sign: a refund rendered as "-130.87", and the first keystroke in the field
   * turned it into 130.87. A $130 credit silently became a $130 expense, with
   * no warning and no way to type the sign back, because the field is a
   * decimal-pad and iOS does not put a minus on it.
   *
   * Only a LEADING minus, and only one. A minus anywhere else is OCR noise or a
   * trailing credit marker, and neither belongs in a field being typed into.
   */
  var negative = /^\s*-/.test(s);
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
  return negative && s !== '' ? '-' + s : s;
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

/**
 * What the field shows when nobody is typing in it.
 *
 * `String(13.6)` is "13.6", so a total entered as "13.60" redrew without its
 * last digit the moment the field lost focus, and read as though the field had
 * refused the second digit of cents. Tyler reported it exactly that way. The
 * stored number was right the whole time; only the resting display was wrong.
 *
 * Money has two decimal places, so this pads to two. Only ever used for the
 * resting state: padding mid-keystroke would fight the typing, which is the
 * whole reason the field keeps a draft.
 */
function moneyDisplay(value) {
  if (value == null || typeof value !== 'number' || !isFinite(value)) return '';
  return value.toFixed(2);
}

module.exports = {
  sanitizeMoneyText: sanitizeMoneyText,
  moneyValue: moneyValue,
  moneyDisplay: moneyDisplay,
};
