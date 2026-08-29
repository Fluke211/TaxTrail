/*
 * TaxTrail — splitting one money figure across several parts without losing or
 * inventing a cent.
 *
 * This exists because of the sales-tax column in the exports. When a receipt is
 * split across categories, its sales tax is split with it, and the old code
 * rounded each part independently:
 *
 *   $1.00 tax across three equal parts -> 0.33, 0.33, 0.33  = $0.99   (lost)
 *   $0.01 tax across two equal parts   -> 0.01, 0.01        = $0.02   (invented)
 *   $5.00 tax across seven equal parts -> 0.71 x 7          = $4.97   (lost)
 *
 * Losing a cent understates a deduction. INVENTING one is worse: sales tax
 * flows to Schedule A line 5a, so an over-reported figure is an over-claim on a
 * filed return. Both directions are real, and both accumulate across a year of
 * split receipts.
 *
 * The fix is the largest-remainder method: floor every part, then hand the
 * leftover cents to the parts with the largest discarded fractions. The result
 * always sums to exactly the amount being divided, and no part is ever more
 * than one cent from its exact share.
 *
 * Plain CommonJS so the Node test harness can require it directly, matching
 * classifier.js / exporters.js / gates.js / restorePlan.js.
 */
'use strict';

/**
 * Divide `totalCents` across `weights`, in whole cents, summing to exactly
 * `totalCents`.
 *
 * Everything is integers: doing this in dollars is how a half-cent creeps back
 * in through the floor() calls it is meant to control.
 *
 * Ties in the fractional part are broken by index, so the split is
 * deterministic — the same receipt exports the same numbers every time, which
 * matters when a CPA re-runs an export and diffs it against the last one.
 */
function prorateCents(totalCents, weights) {
  var w = (weights || []).map(function (x) {
    var n = Number(x);
    return isFinite(n) && n > 0 ? n : 0;
  });
  var zeros = w.map(function () { return 0; });

  var total = Number(totalCents);
  if (!isFinite(total) || total <= 0) return zeros;
  total = Math.round(total);

  var sumW = w.reduce(function (s, x) { return s + x; }, 0);
  if (sumW <= 0) return zeros;

  var exact = w.map(function (x) { return (total * x) / sumW; });
  var out = exact.map(function (e) { return Math.floor(e); });
  var remainder = total - out.reduce(function (s, v) { return s + v; }, 0);

  var order = exact
    .map(function (e, i) { return { i: i, frac: e - Math.floor(e) }; })
    .sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });

  for (var k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    out[order[k].i] += 1;
  }
  return out;
}

/**
 * The sales-tax column, in dollars, one entry per allocation.
 *
 * `totalCents` is the receipt total, which is normally the sum of the
 * allocation weights — CaptureScreen builds the allocation list as
 * [remainder, ...user splits], so they add up by construction. It is passed
 * separately anyway because restored or hand-edited data need not agree, and
 * when the allocations cover only part of the receipt they should carry only
 * that part of the tax rather than silently absorbing all of it.
 */
function splitSalesTax(salesTax, weightsCents, totalCents) {
  var n = (weightsCents || []).length;
  var empty = [];
  for (var i = 0; i < n; i++) empty.push(null);

  var tax = Number(salesTax);
  if (!isFinite(tax) || tax <= 0) return empty;

  var taxCents = Math.round(tax * 100);
  var sumW = (weightsCents || []).reduce(function (s, x) {
    var v = Number(x);
    return s + (isFinite(v) && v > 0 ? v : 0);
  }, 0);

  var tot = Number(totalCents);
  var covered = taxCents;
  if (isFinite(tot) && tot > 0 && sumW < tot) {
    covered = Math.round(taxCents * (sumW / tot));
  }

  return prorateCents(covered, weightsCents).map(function (c) { return c / 100; });
}

module.exports = { prorateCents: prorateCents, splitSalesTax: splitSalesTax };
