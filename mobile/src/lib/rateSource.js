/*
 * TaxTrail: which sales-tax rate a receipt uses, and which rates are worth
 * remembering for its city.
 *
 * Lifted out of CaptureScreen, where the priority sat inline and nothing could
 * test it, for the reason this project keeps rules in pure modules (D-043).
 *
 * The priority is unchanged: printed on the receipt, then remembered for the
 * city, then derived from the receipt's own tax and subtotal, then last used.
 *
 * What changes is what gets REMEMBERED. CaptureScreen used to store whichever
 * rate the receipt ended up with, derived ones included (D-109).
 */
'use strict';

var PRINTED = 'printed on receipt';
var REMEMBERED = 'remembered for this city';
var DERIVED = 'derived from receipt';
var LAST_USED = 'last used';
var NONE = 'not detected';

/**
 * @param parsed  { taxRatePrinted, taxRate } from parseReceipt
 * @param mem     { rate, fromCity } from taxMemLookup, or null
 * @returns       { taxRate, rateSource }
 */
function pickRate(parsed, mem) {
  if (parsed && parsed.taxRatePrinted) return { taxRate: parsed.taxRatePrinted, rateSource: PRINTED };
  if (mem && mem.fromCity) return { taxRate: mem.rate, rateSource: REMEMBERED };
  if (parsed && parsed.taxRate) return { taxRate: parsed.taxRate, rateSource: DERIVED };
  if (mem) return { taxRate: mem.rate, rateSource: LAST_USED };
  return { taxRate: null, rateSource: NONE };
}

/*
 * Only a PRINTED rate is remembered for the city.
 *
 * A derived rate is tax divided by subtotal, and the classifier's own notes say
 * why that is not a rate: "tax / subtotal can only ever UNDERSTATE the true
 * rate, because non-taxable items sit inside the subtotal." It is a floor, and
 * storing a floor as the city's rate turns it into the answer for every receipt
 * after it, because a remembered city rate outranks a later receipt's own
 * derived one.
 *
 * Tyler's Aberdeen Safeway receipt is the case. Washington does not tax most
 * groceries, so $2.36 of tax over $141.49 derives 1.67% against a real rate
 * near 9.1%. Most US states exempt groceries, so this was not one receipt's
 * problem: every grocery scan in those states would have taught its city a rate
 * several points too low.
 *
 * Re-storing a remembered or last-used rate would only echo what is already
 * stored, so neither is learned either.
 */
function shouldLearn(rateSource, rate) {
  return rateSource === PRINTED && rate > 0;
}

module.exports = {
  pickRate: pickRate,
  shouldLearn: shouldLearn,
  PRINTED: PRINTED,
  REMEMBERED: REMEMBERED,
  DERIVED: DERIVED,
  LAST_USED: LAST_USED,
  NONE: NONE,
};
