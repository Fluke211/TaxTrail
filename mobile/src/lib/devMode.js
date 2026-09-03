/*
 * TaxTrail — the hidden developer switch.
 *
 * Two controls are useful to Tyler and confusing to everyone else: the full
 * JSON backup (whose image paths go stale on reinstall, so it looks like a
 * backup and is not one) and the parser diagnostics dump (raw OCR text, useful
 * only to somebody fixing the parser). Shipping them on the main screen invites
 * a user to pick the wrong "backup" and lose their images.
 *
 * So they hide behind the iOS convention: tap the version stamp repeatedly.
 * Chosen because Tyler is usually phone-only and terminal paste does not work
 * on his phone — a tap gesture is something he can actually perform, and
 * something a normal user will never perform by accident.
 *
 * The counting rules live here, pure, so "seven taps unlocks it" is a test
 * rather than something verified by tapping a phone seven times.
 */
'use strict';

var TAPS_TO_UNLOCK = 7;

// Taps must be a deliberate run, not seven presses spread over a minute of
// idle scrolling. Anything slower than this restarts the count.
var TAP_GAP_MS = 1500;

/*
 * Nothing is announced before the unlock. Not a count, not a hint.
 *
 * This used to show "3 more to enable developer options" from the fourth tap.
 * Tyler's call, 2026-09-02, and it is the right one: the countdown tells a user
 * who tapped the version stamp a few times by accident that there is something
 * here to find, which is the opposite of what a hidden control is for. It also
 * puts the words "developer options" in front of someone who has no use for
 * them, in an app whose Settings screen is meant to be short.
 *
 * The only message is the confirmation after the seventh tap, which cannot
 * reveal anything that has not already happened.
 */

/**
 * Fold one tap into the counter.
 *
 * `state` is `{ count, lastAt }`; pass `{ count: 0, lastAt: 0 }` to start.
 * Returns the next state plus `unlocked` and the message to show, if any.
 */
function tap(state, now) {
  var prev = state || { count: 0, lastAt: 0 };
  var t = typeof now === 'number' ? now : 0;
  var continuing = prev.lastAt > 0 && (t - prev.lastAt) <= TAP_GAP_MS;
  var count = (continuing ? prev.count : 0) + 1;

  if (count >= TAPS_TO_UNLOCK) {
    return { count: 0, lastAt: t, unlocked: true, message: 'Developer options enabled.' };
  }
  return { count: count, lastAt: t, unlocked: false, message: null };
}

module.exports = {
  TAPS_TO_UNLOCK: TAPS_TO_UNLOCK,
  TAP_GAP_MS: TAP_GAP_MS,
  tap: tap,
};
