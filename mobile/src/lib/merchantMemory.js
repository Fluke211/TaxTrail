/*
 * Which stored merchant name belongs to this receipt.
 *
 * Plain JS and free of storage on purpose. This is the decision that was wrong
 * in D-091 and D-092 — looking up, learning and forgetting have to agree about
 * WHICH entry a receipt matches, and when they disagreed a correction left the
 * wrong entry in place to win again later. memory.ts is now only the
 * AsyncStorage wrapper around this, so the rules are reachable by the test
 * harness rather than only by scanning the same store twice on a phone.
 */
var C = require('./classifier.js');

/* City/ZIP-only lines are excluded: they match across every store in town. */
var CITYISH = /^[A-Za-z .'-]{3,24}[,.]?\s+[A-Z]{2}(\s+\d{5})?\s*$/;

/* At most 8 lines from the header, which is where a receipt names itself. */
function fingerprint(ocrText) {
  return String(ocrText || '')
    .split('\n')
    .map(function (l) { return l.trim().toLowerCase(); })
    .filter(function (l) { return l.length >= 6 && l.length <= 40 && !CITYISH.test(l); })
    .slice(0, 8);
}

function digitsOf(s) {
  var m = String(s).match(/\d{2,}/);
  return m ? m[0] : '';
}

/* 0 means "not this store". Two matching lines is the floor: one line matching
 * is a coincidence of layout ("thank you for shopping"), two is a store. */
function matchScore(fp, entry) {
  var score = 0, pairs = 0;
  for (var i = 0; i < fp.length; i++) {
    for (var j = 0; j < (entry.fp || []).length; j++) {
      var sim = C.diceSimilarity(fp[i], entry.fp[j]);
      if (sim < 0.55) continue;
      // Digit gate: street numbers must agree when both lines carry one, so
      // two branches of the same chain do not collapse into one memory.
      var da = digitsOf(fp[i]), db = digitsOf(entry.fp[j]);
      if (da && db && da !== db) continue;
      score += sim; pairs++;
    }
  }
  return pairs >= 2 ? score : 0;
}

function bestIndex(entries, fp) {
  var bi = -1, bs = 0;
  for (var i = 0; i < entries.length; i++) {
    var s = matchScore(fp, entries[i]);
    if (s > bs) { bs = s; bi = i; }
  }
  return bi;
}

function lookup(entries, ocrText) {
  var i = bestIndex(entries, fingerprint(ocrText));
  return i >= 0 ? entries[i].name : null;
}

var MAX_ENTRIES = 40;

/*
 * Store `name` for this receipt, replacing whatever it matched before.
 *
 * Returns null when there is nothing to do. The replacement is the fix: the old
 * code removed only entries that shared the NEW name, so correcting "Mitco" to
 * "Costco" left both stored against the same fingerprint and the wrong one
 * could still win on score. A correction has to replace, or it is not one.
 */
function learn(entries, ocrText, name) {
  if (!name || name === 'Unknown merchant') return null;
  var fp = fingerprint(ocrText);
  if (!fp.length) return null;
  var i = bestIndex(entries, fp);
  if (i >= 0 && entries[i].name === name) return null;
  var kept = entries.filter(function (e, j) { return j !== i && e.name !== name; });
  kept.push({ fp: fp, name: name });
  return kept.slice(-MAX_ENTRIES);
}

/*
 * Drop what this receipt matches, and say what was dropped.
 *
 * Without this there is no way out of a wrong name. Memory beats the parser by
 * design, so one bad name makes every future scan of that store wrong and no
 * parser improvement can ever reach it.
 */
function forget(entries, ocrText) {
  var i = bestIndex(entries, fingerprint(ocrText));
  if (i < 0) return { entries: entries, name: null };
  return {
    entries: entries.filter(function (e, j) { return j !== i; }),
    name: entries[i].name,
  };
}

module.exports = {
  fingerprint: fingerprint,
  matchScore: matchScore,
  bestIndex: bestIndex,
  lookup: lookup,
  learn: learn,
  forget: forget,
  MAX_ENTRIES: MAX_ENTRIES,
};
