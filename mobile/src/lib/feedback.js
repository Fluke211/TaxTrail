/*
 * TaxTrail — what a feedback email contains, decided in one testable place.
 *
 * This file is where the privacy label is either kept or lost, so the rules are
 * here rather than scattered through a screen.
 *
 * Apple's App Privacy guidance makes data OPTIONAL to disclose only if it meets
 * ALL FOUR of these (developer.apple.com/app-store/app-privacy-details):
 *
 *   1. not used for tracking — not linked with third-party data for advertising
 *      or measurement, not shared with a data broker;
 *   2. not used for third-party advertising, our own advertising or marketing,
 *      or the "Other Purposes" bucket;
 *   3. "Collection of the data occurs only in infrequent cases that are not part
 *      of your app's primary functionality, and which are optional for the user";
 *   4. "The data is provided by the user in your app's interface, it is clear to
 *      the user what data is collected, the user's name or account name is
 *      prominently displayed in the submission form alongside the other data
 *      elements being submitted, and the user affirmatively chooses to provide
 *      the data for collection each time."
 *
 * Apple names this case directly: "data collected in optional feedback forms or
 * customer service requests that are unrelated to the primary purpose of the app
 * and meet the other criteria above."
 *
 * Criterion 4 is why this goes through the **system Mail composer** and not an
 * in-app HTTP POST. The composer IS the submission form, and it shows the user's
 * own address in the From field, the body, and every attachment by name, then
 * waits for them to tap Send. An app that posted the same bytes to a server
 * would satisfy 1-3 and fail 4 — and "Data Not Collected" is the entire product
 * pitch, so failing it quietly is not an option (D-059).
 *
 * Everything below therefore defaults to attaching NOTHING. Each attachment is
 * an explicit opt-in, named in plain words, chosen again every time.
 */
'use strict';

// iCloud Mail rejects over 20 MB and most providers sit around 25 MB. Well
// under, because a bounced support email is a silent failure: the user tapped
// Send, saw it leave, and nothing arrived.
var MAX_ATTACH_BYTES = 8 * 1024 * 1024;

/** A one-line description of each thing the user can attach, in their words. */
var ATTACHMENT_LABELS = {
  diagnostics: 'What the scanner read (text only, no photos)',
  images: 'The receipt photographs',
};

/**
 * Pick images to attach without blowing the size limit.
 *
 * Newest first, because a problem being reported now is about a recent scan.
 * Returns what fits and what did not, so the UI can say "3 of 7 images" rather
 * than silently sending fewer than the user ticked.
 */
function selectImages(receipts, maxBytes) {
  var limit = typeof maxBytes === 'number' ? maxBytes : MAX_ATTACH_BYTES;
  var withImages = (receipts || []).filter(function (r) { return r && r.imagePath && r.size > 0; });
  var chosen = [];
  var used = 0;
  var skipped = 0;
  for (var i = 0; i < withImages.length; i++) {
    var r = withImages[i];
    if (used + r.size <= limit) { chosen.push(r); used += r.size; }
    else skipped++;
  }
  return { chosen: chosen, skipped: skipped, bytes: used };
}

/**
 * The body text.
 *
 * It restates what is attached INSIDE the message. The Mail composer already
 * lists the attachments, but a user who forwards or replies later should still
 * be able to see what they sent — and it makes criterion 4's "it is clear to the
 * user what data is collected" true in the artifact itself, not only in a screen
 * they have already dismissed.
 */
function buildBody(opts) {
  var o = opts || {};
  var lines = [];
  lines.push(String(o.message || '').trim());
  lines.push('');
  lines.push('---');
  lines.push('Sent from TaxTrail ' + (o.version || ''));
  if (o.receiptCount != null) lines.push(o.receiptCount + ' receipts on this device');

  var attached = [];
  if (o.includeDiagnostics) attached.push(ATTACHMENT_LABELS.diagnostics);
  if (o.includeImages) {
    attached.push(ATTACHMENT_LABELS.images
      + (o.imageCount != null ? ' (' + o.imageCount + ')' : ''));
  }
  lines.push('Attached: ' + (attached.length ? attached.join('; ') : 'nothing'));
  return lines.join('\n');
}

/** Subject line. Kept stable and prefixed so support mail can be filtered. */
function buildSubject(kind, version) {
  var v = version ? ' — ' + version : '';
  return (kind === 'scan' ? 'TaxTrail: scanning problem' : 'TaxTrail feedback') + v;
}

module.exports = {
  MAX_ATTACH_BYTES: MAX_ATTACH_BYTES,
  ATTACHMENT_LABELS: ATTACHMENT_LABELS,
  selectImages: selectImages,
  buildBody: buildBody,
  buildSubject: buildSubject,
};
