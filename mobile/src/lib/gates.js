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

module.exports = { isOverFreeLimit, shouldAskForReview };
