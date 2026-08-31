/*
 * TaxTrail — the two gating decisions, as pure functions.
 *
 * Both used to live inline in CaptureScreen, where they were untestable: the
 * only way to exercise "what happens on the 11th scan" was to scan eleven
 * receipts on a phone. Neither rule is complicated, but both are the kind that
 * are quietly wrong for months — one costs revenue, the other costs goodwill.
 *
 * Plain CommonJS so the Node test harness can require it directly, matching
 * classifier.js / exporters.js / restorePlan.js.
 */
'use strict';

/**
 * Is this user out of free scans?
 *
 * Pro is unlimited. Otherwise the month's scan count is compared against the
 * limit BEFORE the new scan, so a limit of 10 permits scans 1..10 and gates the
 * 11th. Getting the boundary wrong by one either gives away a scan or — worse —
 * blocks a user who paid nothing but was promised ten.
 */
function isOverFreeLimit(opts) {
  var o = opts || {};
  if (o.isPro) return false;
  var used = Number(o.scansThisMonth);
  if (!isFinite(used) || used < 0) used = 0;
  var limit = Number(o.limit);
  if (!isFinite(limit) || limit < 0) limit = 0;
  return used >= limit;
}

/**
 * Should we show the App Store review prompt?
 *
 * Asked once, ever, after the Nth successful scan — on a LIFETIME count, not a
 * monthly one. The original used `countThisMonth() === 3`, which had two
 * defects:
 *
 *   1. It re-fired on the third scan of every month. iOS throttles the dialog
 *      to three a year so nothing visibly broke, but the app was asking again
 *      and again and burning that quota on users it had already asked.
 *   2. Exact equality against a live count is fragile. Delete a receipt and the
 *      count revisits 3; save two receipts before the check runs and it skips
 *      3 entirely and never asks at all.
 *
 * Using `>=` against a lifetime count with a persisted "asked" flag fixes both:
 * it cannot be skipped, and it cannot repeat.
 */
function shouldAskForReview(opts) {
  var o = opts || {};
  if (o.alreadyAsked) return false;
  var scans = Number(o.lifetimeScans);
  if (!isFinite(scans)) return false;
  var after = Number(o.askAfter);
  if (!isFinite(after) || after < 1) after = 3;
  return scans >= after;
}

/**
 * The free-tier scan meter shown on the capture screen.
 *
 * Returns null for Pro, and that is the point rather than an edge case: Tyler
 * asked for the counter "only for the free tier". A paying user has nothing to
 * count and a meter reading "3 of ∞" is a worse screen, so the caller renders
 * nothing at all rather than a disabled or infinite variant.
 *
 * `remaining` is clamped at zero. A user who somehow scanned past the limit
 * (a month boundary, a restored archive) should see "0 left", never "-2 left".
 */
function freeScanMeter(opts) {
  var o = opts || {};
  if (o.isPro) return null;

  var limit = Number(o.limit);
  if (!isFinite(limit) || limit < 0) limit = 0;
  var used = Number(o.scansThisMonth);
  if (!isFinite(used) || used < 0) used = 0;
  if (used > limit) used = limit;

  var remaining = limit - used;
  return {
    used: used,
    limit: limit,
    remaining: remaining,
    // Delegated, never restated. Two copies of "when does the free tier end"
    // is how the screen comes to say "1 left" while the paywall fires.
    exhausted: isOverFreeLimit(o),
    // Phrased as what is LEFT, not what is spent. "7 of 10 free scans left"
    // reads as headroom; "3 of 10 used" reads as a bill.
    label: remaining === 1
      ? '1 free scan left this month'
      : remaining + ' of ' + limit + ' free scans left this month',
    // 0..1, the fraction USED — the bar fills up as the month is spent, so the
    // exhausted state is a full bar that can carry a warning colour. Filling it
    // with the fraction remaining instead leaves 0% width at the limit, which
    // is the one moment the colour needs to be visible.
    fill: limit > 0 ? used / limit : 1,
  };
}

module.exports = { isOverFreeLimit, shouldAskForReview, freeScanMeter };
