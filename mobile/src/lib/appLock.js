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

/*
 * The whole gate as a reducer, so the state machine is testable too.
 *
 * `shouldLock` alone was not enough. The bug review caught before r31 shipped
 * lived entirely in the wiring: `active` events were judged against a
 * `backgroundedAt` that no unlock ever cleared, so the Face ID prompt, whose own
 * dismissal fires `active`, re-locked the app the instant it succeeded. Pure
 * rules with an untested state machine around them is the shape that produced
 * it, and this is the answer to that: every transition is a fixture.
 *
 * State:
 *   locked          authentication is required; the lock screen shows
 *   covered         content is hidden but nothing is asked, because iOS is
 *                   about to photograph the screen for the app switcher
 *   backgroundedAt  when the app last really left, or null
 *   prompts         a counter, bumped every time the app newly needs asking.
 *                   `locked` alone cannot re-arm the prompt: a user who
 *                   cancels leaves it true, so the next lock event changes
 *                   nothing and no prompt ever appears again.
 */
var INITIAL = { locked: false, covered: false, backgroundedAt: null, prompts: 0 };

function lockNow(state) {
  // `prompts` is bumped even when already locked, and that is the point: a user
  // who cancelled is still locked, so nothing about `locked` can tell the UI to
  // ask again.
  return { locked: true, covered: false, backgroundedAt: null, prompts: state.prompts + 1 };
}

/**
 * @param {object} state    previous state, or null to start from INITIAL
 * @param {object} event    { type: 'start' | 'inactive' | 'background' | 'active' | 'unlocked', now }
 * @param {object} ctx      { enabled, available }
 */
function reduce(state, event, ctx) {
  var s = state || INITIAL;
  var e = event || {};
  var c = ctx || {};
  var now = typeof e.now === 'number' ? e.now : 0;
  var armed = !!c.enabled && !!c.available;

  switch (e.type) {
    case 'start':
      return shouldLock({ enabled: c.enabled, available: c.available, backgroundedAt: null, now: now })
        ? lockNow(s)
        : { locked: false, covered: false, backgroundedAt: null, prompts: s.prompts };

    // Resigning active is not leaving. It covers, because a snapshot may
    // follow, and it must NOT start the clock: iOS fires this for the Face ID
    // prompt itself.
    case 'inactive':
      return armed ? { ...s, covered: true } : s;

    case 'background':
      return { ...s, covered: armed, backgroundedAt: now };

    case 'active': {
      // Never left, so there is nothing to judge. This is the inactive/active
      // blip, and treating it as a cold start is the loop.
      if (s.backgroundedAt == null) return { ...s, covered: false };
      var relock = shouldLock({
        enabled: c.enabled, available: c.available, backgroundedAt: s.backgroundedAt, now: now,
      });
      // The mark is consumed either way, so one trip away is judged once.
      return relock
        ? lockNow(s)
        : { locked: s.locked, covered: false, backgroundedAt: null, prompts: s.prompts };
    }

    case 'unlocked':
      return { locked: false, covered: false, backgroundedAt: null, prompts: s.prompts };

    default:
      return s;
  }
}

module.exports = {
  GRACE_MS: GRACE_MS,
  INITIAL: INITIAL,
  shouldLock: shouldLock,
  reduce: reduce,
};
