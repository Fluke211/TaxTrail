/*
 * TaxTrail — what category and confidence to show once a merchant is known.
 *
 * A receipt whose header says nothing useful parses as Uncategorized. If the
 * user has already taught the app what that store is called, the remembered
 * name is worth a second classification: a Starbucks app receipt is headed
 * "Mobile order" and says nothing else about what was bought, but "Starbucks"
 * says everything (D-101).
 *
 * That second pass already existed in CaptureScreen. It took the CATEGORY from
 * the new classification and left the CONFIDENCE behind:
 *
 *     let category = parsed.category;
 *     if (remembered && parsed.category === 'Uncategorized') {
 *       const recls = C.classify(text, remembered);
 *       if (recls.name !== 'Uncategorized') category = recls.name;
 *     }
 *     ...
 *     category, confidence: parsed.confidence,
 *
 * So the screen reported a category from one classification and a confidence
 * from a different, discarded one, which by definition had just returned
 * Uncategorized and so was always "low". The app read
 *
 *     Auto-categorized as "Business Meals" (low confidence)
 *
 * on a match that actually scored 27 and was high. It understates the app to
 * the user, and the two halves of that sentence did not come from the same
 * judgement, which is the real defect (D-102).
 *
 * Extracted here because the bug was only ever possible in screen wiring that
 * nothing tested, which is the reason this project keeps its rules in pure
 * modules (D-043).
 *
 * r47, after Tyler asked the right question about r46: should a field say
 * "high confidence" when the user is the one who worked it out? No. The
 * confidence a receipt stores is a claim about THE PARSER, and when the
 * category came from a name the user taught, the parser produced nothing.
 * Handing back the second classification's "high" credited it with an answer
 * it did not produce, which is the exact thing the snapshot three lines below
 * its own call site already refuses to do:
 *
 *     // `parsed`, not the values above: the merchant-memory override and the
 *     // tax-rate fallbacks are the app being helpful, and folding them in
 *     // would credit the parser with answers it did not produce.
 *
 * So the source becomes its own value. REMEMBERED is not a point on the
 * high/medium/low scale and must never be compared against one: it says where
 * the answer came from, which is a different question from how sure anyone is
 * (D-103).
 */
'use strict';

/*
 * The confidence of a category that did not come from the receipt.
 *
 * Deliberately not 'high'. This value is STORED on the row and travels into
 * the diagnostics export, where the parser's accuracy is measured. A row the
 * parser could not categorize, recorded as a high-confidence parser success,
 * inflates that measurement, which is the failure D-056 exists to prevent:
 * "we do not know" is a different claim from "it was correct".
 */
var REMEMBERED = 'remembered';

/*
 * The category the USER picked from the list.
 *
 * This is what Tyler was pointing at all along, and r47 fixed the wrong half
 * of it. Choosing a category set `category` and left `confidence` alone, so
 * the review banner read
 *
 *     Auto-categorized as "Business Meals" (low confidence)
 *
 * about a category the app had not chosen at all. It claimed the work and
 * then undersold it, on a receipt where the parser had in fact scored ZERO.
 *
 * Stored for the same reason as REMEMBERED: `confidence` travels into the
 * diagnostics export, and a row the user categorized by hand is not a parser
 * success at any level (D-104).
 */
var CHOSEN = 'chosen';

/**
 * @param parsed      what the parser returned: { category, confidence }
 * @param remembered  the merchant name the user has taught, or null
 * @param reclassify  (name) => { name, confidence }, normally a classify call
 *
 * Returns { category, confidence }, always from the SAME classification.
 */
function resolveCategory(parsed, remembered, reclassify) {
  var category = (parsed && parsed.category) || 'Uncategorized';
  var confidence = (parsed && parsed.confidence) || 'low';
  // Only a receipt the parser could not place is worth a second opinion. A
  // category it did find came from the receipt's own words and outranks a
  // guess from the name alone.
  if (remembered && category === 'Uncategorized' && typeof reclassify === 'function') {
    var recls = reclassify(remembered);
    if (recls && recls.name && recls.name !== 'Uncategorized') {
      return { category: recls.name, confidence: REMEMBERED };
    }
  }
  return { category: category, confidence: confidence };
}

module.exports = {
  resolveCategory: resolveCategory,
  REMEMBERED: REMEMBERED,
  CHOSEN: CHOSEN,
};
