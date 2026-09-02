/*
 * The bridge between a stored receipt path and a path this launch can open.
 *
 * The rules live in `paths.js`, which is pure and unit-tested. This file is the
 * two lines of it that need `documentDirectory`, kept apart so the rules stay
 * testable in node — the same split as classifier.js and gates.js.
 *
 * Every place that displays, reads or deletes a receipt photograph goes through
 * `resolveImage`. A path out of the database is never handed straight to
 * `<Image>` or to FileSystem: see paths.js for why that broke.
 */
import * as FileSystem from 'expo-file-system/legacy';
const P = require('./paths.js');

/*
 * Where receipt photographs live in THIS launch's container.
 *
 * Built by the same join as `resolveImage`, not by a template literal: those
 * were two different pieces of string concatenation for the same path, and only
 * one of them coped with a `documentDirectory` that has no trailing slash.
 *
 * `null` off-device, where there is no documents directory. Every caller has to
 * say what it does about that rather than writing files to "nullreceipts/".
 */
export const RECEIPTS_DIR: string | null = P.dirPath(FileSystem.documentDirectory);

/** Database form: `receipts/x.jpg`. Call before writing a path to a row. */
export function storeImage(p: string | null): string | null {
  return P.storedPath(p);
}

/** Openable form for this launch. Call before displaying or reading a path. */
export function resolveImage(stored: string | null): string | null {
  return P.absolutePath(stored, FileSystem.documentDirectory);
}
