/*
 * TaxTrail — what a date field should store, whatever order it was typed in.
 *
 * The receipt date was a plain freeform TextInput bound straight to the stored
 * string. Whatever was typed became the stored value, and nothing downstream
 * tolerates that, because everything assumes ISO:
 *
 *   yearsPresent()  does date.slice(0, 4) and requires four digits, so a date
 *                   typed "7-25-2026" yields "7-25", fails the test, and the
 *                   receipt DISAPPEARS from every per-year export option.
 *   inRange()       compares ISO strings, so the same receipt is in no year.
 *   db.listReceipts ORDER BY date DESC is a string sort, so "7-25-2026" sorts
 *                   above every "2026-.." date and the receipt jumps to the top
 *                   of the list.
 *
 * All three fail SILENTLY. The receipt still shows its total and still sits in
 * "All receipts", so the only symptom is a year's export quietly missing a row,
 * which is the worst way for a tax record to be wrong (D-100).
 *
 * So the field normalizes to ISO rather than trusting what was typed, and this
 * module holds the rules as pure functions so they are unit-testable instead of
 * something you verify by typing on a phone — same reasoning as moneyInput.js
 * and prorate.js (D-043).
 */
'use strict';

/* Days per month, with February resolved by the caller. */
var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Is this a real calendar day? 31 February is not, and nor is 29 Feb 2027. */
function isRealDay(y, m, d) {
  if (!(y >= 1900 && y <= 2999)) return false;
  if (!(m >= 1 && m <= 12)) return false;
  if (!(d >= 1)) return false;
  var max = m === 2 && isLeap(y) ? 29 : DAYS[m - 1];
  return d <= max;
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

function iso(y, m, d) {
  return isRealDay(y, m, d) ? y + '-' + pad(m) + '-' + pad(d) : null;
}

/**
 * A two-digit year is in this century.
 *
 * The usual 69/99 pivot would read "7/25/99" as 1999. No receipt this app will
 * ever hold is from the 1900s, and a tax record dated 1999 is a worse failure
 * than one dated 2099, which at least looks obviously wrong.
 */
function fullYear(n) {
  return n < 100 ? 2000 + n : n;
}

/**
 * The ISO day a typed date means, or null when it cannot be read as one.
 *
 * Accepted, with any of `-`, `/`, `.` or a space between the parts:
 *
 *   2026-07-25   2026/7/25     year first, so year-month-day
 *   7-25-2026    07/25/2026    year last, so US month-day-year
 *   7/25/26                    two-digit year, read as 2026
 *   20260725                   eight digits, unambiguous
 *
 * Month-day-year is the default for a year-last date because this is a US
 * small-business tax product and that is what a US receipt prints. The one
 * exception is a first part that CANNOT be a month: "25/07/2026" has to be
 * day-month-year, and reading it that way is strictly better than refusing it,
 * since month-day-year would be invalid anyway.
 *
 * Deliberately returns null rather than guessing when the day is not real.
 * "13/25/2026" is not a date in either order, and storing a plausible-looking
 * wrong one is how a tax record goes bad without anyone noticing.
 */
function normalizeDateInput(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return null;

  // 20260725 — eight digits can only be ISO, so it needs no separator.
  if (/^\d{8}$/.test(s)) {
    return iso(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
  }

  var parts = s.split(/[\-\/.\s]+/).filter(function (p) { return p !== ''; });
  if (parts.length !== 3) return null;
  for (var i = 0; i < 3; i++) {
    if (!/^\d{1,4}$/.test(parts[i])) return null;
  }
  var a = +parts[0], b = +parts[1], c = +parts[2];

  // Year first.
  if (parts[0].length === 4) return iso(a, b, c);
  // Year last. A first part over 12 cannot be a month, so it is the day.
  if (a > 12 && b <= 12) return iso(fullYear(c), b, a);
  return iso(fullYear(c), a, b);
}

/** Already a real ISO day? Used to decide whether a stored value needs fixing. */
function isIsoDay(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
  return !!m && isRealDay(+m[1], +m[2], +m[3]);
}

module.exports = {
  normalizeDateInput: normalizeDateInput,
  isIsoDay: isIsoDay,
  isRealDay: isRealDay,
};
