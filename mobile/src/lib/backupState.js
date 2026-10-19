/*
 * What the user's receipts are actually protected by, and whether an archive is
 * overdue.
 *
 * Plain JS and storage-free so the harness can reach the decision, same pattern
 * as gates.js and merchantMemory.js. The copy this drives is the only place the
 * app tells a user what survives losing the phone, so it has to be right rather
 * than reassuring.
 *
 * Counted by TIMESTAMP, not by set size. Comparing counts looks equivalent and
 * is not: delete one receipt and add another and the count is unchanged while a
 * receipt nobody has archived now exists. The risk being measured is receipts
 * that have never been in an archive, so the measure is "created after the
 * newest receipt the last full archive contained".
 */

function daysBetween(fromIso, now) {
  var a = Date.parse(fromIso);
  if (!isFinite(a)) return null;
  var b = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

/*
 * levels:
 *   empty    nothing scanned yet, so nothing to warn about
 *   never    receipts exist and no full archive has ever been made
 *   behind   receipts exist that no archive contains
 *   current  every receipt is in an archive the user has made
 *
 * A RANGED archive ("2026 only") deliberately does not count. It is a year's
 * substantiation, not a backup, and exportArchive's own README says so.
 */
function backupAdvice(opts) {
  var o = opts || {};
  var createdAts = o.createdAts || [];
  var lastExportAt = o.lastExportAt || null;
  var lastExportNewest = o.lastExportNewest || null;

  if (!createdAts.length) {
    return { level: 'empty', unexported: 0, daysSince: null };
  }
  if (!lastExportAt) {
    return { level: 'never', unexported: createdAts.length, daysSince: null };
  }

  var unexported = 0;
  for (var i = 0; i < createdAts.length; i++) {
    // No newest recorded means the archive was empty, so everything is newer.
    if (!lastExportNewest || String(createdAts[i]) > String(lastExportNewest)) unexported++;
  }
  return {
    level: unexported > 0 ? 'behind' : 'current',
    unexported: unexported,
    daysSince: daysBetween(lastExportAt, o.now || new Date()),
  };
}

/* The one line shown under the archive rows. Deliberately states what we KNOW
 * (an archive was made, and how many receipts came after it) and never that the
 * data is "backed up": the share sheet does not tell us where the file went, or
 * whether the user cancelled out of it. Claiming a backup we cannot see would be
 * the worst possible thing to be wrong about. */
function backupSummary(advice) {
  var a = advice || {};
  var n = a.unexported || 0;
  var plural = n === 1 ? '' : 's';
  if (a.level === 'empty') return null;
  if (a.level === 'never') {
    return n + ' receipt' + plural + ' here, and no archive made yet.';
  }
  if (a.level === 'behind') {
    var when = a.daysSince === 0 ? 'today'
      : a.daysSince === 1 ? 'yesterday'
      : a.daysSince + ' days ago';
    return n + ' receipt' + plural + ' added since the last archive, made ' + when + '.';
  }
  var ago = a.daysSince === 0 ? 'today'
    : a.daysSince === 1 ? 'yesterday'
    : a.daysSince + ' days ago';
  return 'Every receipt here is in the archive made ' + ago + '.';
}

module.exports = { backupAdvice: backupAdvice, backupSummary: backupSummary };
