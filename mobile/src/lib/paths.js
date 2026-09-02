/*
 * Where a receipt photograph lives, and why the answer cannot be written down.
 *
 * iOS gives an app a Data container whose path contains a UUID:
 *
 *   file:///var/mobile/Containers/Data/Application/<UUID>/Documents/receipts/x.jpg
 *
 * **That UUID is not stable.** Apple's File System Programming Guide says so
 * outright: the container may be relocated between launches, and reinstalling
 * or updating the app is the common way it happens. The files come with it;
 * only the path changes. Anything that stored the old absolute string is now
 * pointing at a directory that does not exist.
 *
 * That is exactly what happened when Tyler moved from build 5 to build 6: every
 * receipt row still held a path under the previous container, so the Receipts
 * tab rendered a list of receipts with no photographs. The images were never
 * gone; the app was looking in last week's address.
 *
 * So the database stores a RELATIVE path — `receipts/x.jpg` — and the absolute
 * one is rebuilt at the moment of use, against whatever `documentDirectory` is
 * today. A stored path is a fact about the app; an absolute path is a fact
 * about this launch, and the two must not be confused.
 *
 * Plain JS with no imports, like classifier.js and gates.js, so the rules are
 * unit-tested in node rather than only reachable by reinstalling an app.
 */
'use strict';

var SUBDIR = 'receipts/';

/**
 * Normalize any path we have ever written into the stored form, `receipts/x.jpg`.
 *
 * Accepts a fresh absolute URI, a stale absolute URI from an older container,
 * or an already-relative path, because all three exist in the wild: rows
 * written before this module, rows written after it, and the value the OCR
 * pipeline hands back mid-scan.
 */
function storedPath(p) {
  if (!p) return null;
  var s = String(p);
  if (s.indexOf(SUBDIR) === 0) return s;

  // Everything after the LAST `/receipts/` — last, not first, because a
  // container path could itself contain that word.
  var marker = '/' + SUBDIR;
  var at = s.lastIndexOf(marker);
  if (at !== -1) return SUBDIR + s.slice(at + marker.length);

  // A path with no `/receipts/` in it is not one of ours, and guessing is
  // worse than admitting that: relocating it to `receipts/<basename>` would
  // name a file that does not exist, and whatever then deletes it would report
  // success while the real photograph stayed on the device. A bare file name
  // is the same guess with less to go on, so it gets the same answer.
  return null;
}

/**
 * Rebuild the absolute URI for this launch.
 *
 * `docDir` is `FileSystem.documentDirectory`, passed in rather than imported so
 * this file stays pure. A legacy absolute value is normalized first, which is
 * what makes existing rows render again with no migration having to run first.
 */
function absolutePath(stored, docDir) {
  if (!stored || !docDir) return null;
  var rel = storedPath(stored);
  if (!rel) return null;
  return join(docDir, rel);
}

/**
 * Where receipt photographs live in a given container.
 *
 * Exists so the directory a file is WRITTEN to and the path it is READ back
 * from are built by the same code. They were built by two different pieces of
 * string concatenation, only one of which handled a `documentDirectory` with no
 * trailing slash.
 */
function dirPath(docDir) {
  return docDir ? join(docDir, SUBDIR) : null;
}

function join(base, rest) {
  var b = String(base);
  return (b.charAt(b.length - 1) === '/' ? b : b + '/') + rest;
}

module.exports = {
  SUBDIR: SUBDIR,
  storedPath: storedPath,
  absolutePath: absolutePath,
  dirPath: dirPath,
};
