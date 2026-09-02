/*
 * When should the app be locked?
 *
 * Pure decision rules, unit-tested in node, so "does a two-second trip to the
 * share sheet demand Face ID again" is a test rather than something checked by
 * unlocking a phone repeatedly. The biometric call itself lives in
 * appLockNative.ts.
 *
 * The shape of the feature (D-079):
 *
 *  - **On by default.** Tyler's call. The app holds a year of financial records
 *    on a device other people pick up.
 *  - **Off is one tap away**, in Settings, and the toggle is honoured even when
 *    the phone has Face ID.
 *  - **Never lock a phone that cannot unlock.** No hardware, or nothing
 *    enrolled, means no lock at all. A privacy feature that bricks the app is
 *    not a privacy feature.
 *  - **A grace period.** Photographing a receipt, sharing an export and picking
 *    an image all leave the app briefly. Demanding a face scan on the way back
 *    from a two-second detour trains people to turn the feature off.
 */
'use strict';

/*
 * How long the app may be in the background before it locks again.
 *
 * 60 seconds: long enough for a share sheet, a Mail composer, or a glance at a
 * notification; short enough that a phone left on a table locks. This is the
 * number to change if it annoys, and the tests pin both sides of it.
 */
var GRACE_MS = 60 * 1000;

/**
 * Should the app be locked right now?
 *
 * @param {object} o
 *  - enabled: the user's Settings choice
 *  - available: hardware present AND a biometric or passcode enrolled
 *  - backgroundedAt: when the app last went to the background, or null for a
 *    cold start
 *  - now: current time in ms
 */
function shouldLock(o) {
  var opts = o || {};
  if (!opts.enabled) return false;
  if (!opts.available) return false;

  // A cold start always locks. There is no "recently unlocked" to lean on: the
  // process is new, and this is the case the feature exists for.
  if (opts.backgroundedAt == null) return true;

  var now = typeof opts.now === 'number' ? opts.now : 0;
  var away = now - opts.backgroundedAt;

  // Defensive: a clock change can make `away` negative. Treat an impossible
  // interval as a long one, because the safe answer is to ask.
  if (away < 0) return true;

  return away >= GRACE_MS;
}

module.exports = { GRACE_MS: GRACE_MS, shouldLock: shouldLock };
