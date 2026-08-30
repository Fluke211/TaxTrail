/*
 * TaxTrail — did the user have to correct the parser?
 *
 * Tyler asked for an `edited: true` flag in the diagnostics export. The flag on
 * its own answers "was this row touched"; what the parser actually needs is
 * "touched HOW", because a corrected receipt is a labelled training example and
 * an uncorrected one is not.
 *
 * So a receipt stores `parsedSnapshot`: the classifier's own output, frozen at
 * scan time, before the merchant-memory override and before any keystroke. The
 * flag is then derived rather than tracked — no bookkeeping to get out of sync,
 * and the diagnostics export can say not just "edited" but "the parser read the
 * total as 25.00 and the truth is 26.50", which is exactly the pair that fixes
 * a parser bug.
 *
 * Rows scanned before this existed have no snapshot. They report `null`, not
 * `false`: "we do not know" is a different claim from "it was correct", and
 * scoring the parser against rows that silently claim correctness would inflate
 * the numbers.
 *
 * Pure, so the rules are unit-testable rather than something you verify by
 * typing on a phone — same reasoning as gates.js, prorate.js, moneyInput.js.
 */
'use strict';

// The fields the classifier produces AND the user can change. Notes are never
// parsed; taxRate comes from four possible sources (printed, city memory,
// derived, last used) so a difference there is not evidence about the parser.
var COMPARED = ['merchant', 'date', 'total', 'salesTax', 'category'];

function normText(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

/** Money compares in whole cents. Two values a hundredth of a cent apart are
 *  the same amount, and float arithmetic makes that a real possibility. */
function sameMoney(a, b) {
  var na = a == null || a === '' ? null : Number(a);
  var nb = b == null || b === '' ? null : Number(b);
  if (na === null || nb === null) return na === nb;
  if (!isFinite(na) || !isFinite(nb)) return false;
  return Math.round(na * 100) === Math.round(nb * 100);
}

function sameField(field, was, now) {
  if (field === 'total' || field === 'salesTax') return sameMoney(was, now);
  return normText(was) === normText(now);
}

/**
 * Which of the compared fields differ between the parser's output and what is
 * stored now. Returns field names, or null when there is no snapshot to
 * compare against.
 */
function changedFields(snapshot, receipt) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  var out = [];
  for (var i = 0; i < COMPARED.length; i++) {
    var f = COMPARED[i];
    if (!sameField(f, snapshot[f], receipt ? receipt[f] : undefined)) out.push(f);
  }
  return out;
}

/** true / false / null — null meaning "scanned before snapshots existed". */
function wasEdited(snapshot, receipt) {
  var changed = changedFields(snapshot, receipt);
  return changed === null ? null : changed.length > 0;
}

/** Parse the stored JSON without letting a corrupt row take down an export. */
function readSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    var v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch (e) {
    return null;
  }
}

/** What to freeze at scan time: the classifier's answer, nothing else. */
function snapshotOf(parsed) {
  var p = parsed || {};
  return {
    merchant: p.merchant || '',
    date: p.date || '',
    // taxTotal is the classifier's name for what the receipt calls sales tax.
    total: p.total == null ? null : p.total,
    salesTax: p.taxTotal == null || p.taxTotal <= 0 ? null : p.taxTotal,
    category: p.category || '',
    confidence: p.confidence || '',
  };
}

module.exports = {
  COMPARED: COMPARED,
  changedFields: changedFields,
  wasEdited: wasEdited,
  readSnapshot: readSnapshot,
  snapshotOf: snapshotOf,
};
