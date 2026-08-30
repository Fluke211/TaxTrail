#!/usr/bin/env node
/*
 * Does the app actually use every permission it asks for?
 *
 * A config plugin that contributes a purpose string puts a permission in the
 * shipped Info.plist whether or not any code ever asks for it. Nothing in the
 * toolchain objects: the plugin is configured, the string is written, prebuild
 * succeeds. The permission is simply never used.
 *
 * Build 4 shipped exactly that. `expo-local-authentication` and `expo-location`
 * were compiled in with hand-written purpose strings, the App Review notes
 * described an app lock and a mileage log, and no file imported either module
 * (D-066). Two earlier checks passed it, because both compared documents with
 * documents: the plist against the plugin config, then the notes against the
 * plist. All three agreed. None of them was the code.
 *
 * For an app whose entire pitch is restraint, a permission with no feature
 * behind it is the corrosive thing D-007 was written to prevent — arrived at
 * from the other direction.
 *
 * THE RULE
 *   Every permission-bearing plugin in app.json must have its module imported
 *   somewhere the app can reach. A guarded require inside a function counts:
 *   that is a real, deliberately optional feature (the isRestoreAvailable()
 *   pattern). Nothing at all does not.
 *
 *   To retire a permission, remove the plugin from app.json — and remember the
 *   binary keeps it until the next native build.
 *
 *   node scripts/check-permissions.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/*
 * Plugins that put a permission in front of a user, and the human name of what
 * they ask for. Listed explicitly rather than sniffed from the plugin's options
 * so that adding a plugin means making a decision about it here.
 *
 * A plugin whose permission options are all disabled still belongs on this
 * list — expo-image-picker sets microphonePermission:false, and the reason that
 * is safe is that its camera and photo strings ARE used.
 */
const PERMISSION_PLUGINS = {
  'expo-image-picker': 'camera, photo library',
  'expo-camera': 'camera',
  'react-native-document-scanner-plugin': 'camera',
  'expo-local-authentication': 'Face ID',
  'expo-location': 'location (when in use)',
  'expo-notifications': 'notifications',
  'expo-media-library': 'photo library (read/write)',
  'expo-contacts': 'contacts',
  'expo-calendar': 'calendar',
};

/*
 * What build 4 already shipped unjustified, so CI can hold the line without
 * failing on a binary nobody can change without a native build.
 *
 * Ratchet, not an exemption — same shape as BASELINE in check-contrast.js. A
 * NEW unused permission fails the build. These three fail nothing today and
 * are a standing to-do: D-066 is the decision, and whichever way it goes this
 * list gets shorter, never longer.
 *
 *   expo-local-authentication  no app lock exists
 *   expo-location              no mileage log exists
 *   expo-camera                the camera permission IS justified — by
 *                              expo-image-picker and the document scanner —
 *                              so this one is dead native weight rather than
 *                              an unexplained prompt. Still goes in build 5.
 */
const BASELINE = [
  'expo-local-authentication',
  'expo-location',
  'expo-camera',
];

/** Every .ts/.tsx/.js the app can actually reach at runtime. */
function sourceFiles() {
  const out = [];
  const skip = new Set(['node_modules', 'ios', 'android', '__tests__', 'scripts', '.expo']);
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (skip.has(name) || name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(full);
    }
  })(ROOT);
  return out;
}

/** Plugin names as written in app.json — a plugin is a string or [name, opts]. */
function configuredPlugins() {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  return (app.expo.plugins || []).map((p) => (Array.isArray(p) ? p[0] : p));
}

const files = sourceFiles();
const blobs = files.map((f) => fs.readFileSync(f, 'utf8'));

/* A static import OR a guarded require — both are real use. */
function usedIn(mod) {
  const esc = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:from\\s*|require\\s*\\(\\s*)['"]${esc}(?:/[^'"]*)?['"]`);
  for (let i = 0; i < blobs.length; i++) if (re.test(blobs[i])) return files[i];
  return null;
}

const unused = [];
const used = [];
for (const name of configuredPlugins()) {
  if (!(name in PERMISSION_PLUGINS)) continue;
  const at = usedIn(name);
  if (at) used.push([name, path.relative(ROOT, at)]);
  else unused.push(name);
}

for (const [name, at] of used) {
  console.log(`  ok    ${name.padEnd(38)} used in ${at}`);
}

const fresh = unused.filter((n) => BASELINE.indexOf(n) === -1);
const held = unused.filter((n) => BASELINE.indexOf(n) !== -1);

for (const name of held) {
  console.log(`  known ${name.padEnd(38)} baselined — asks for ${PERMISSION_PLUGINS[name]} (D-066)`);
}

/* A baseline entry that got fixed should leave the list, or it stops meaning
 * anything. Cheap to notice, so notice it. */
const stale = BASELINE.filter((n) => unused.indexOf(n) === -1);
if (stale.length) {
  console.log(`\n${stale.join(', ')} no longer unused — drop from BASELINE in this file.`);
}

if (!fresh.length) {
  console.log(held.length
    ? `\nNo new unjustified permissions. ${held.length} baselined and shipped in build 4;`
      + ' D-066 decides whether they leave the binary or earn their keep.'
    : '\nEvery permission this app asks for has code behind it.');
  process.exit(0);
}

console.error('\nNEW permissions requested by a feature that does not exist:\n');
for (const name of fresh) {
  console.error(`  ${name}  — asks for ${PERMISSION_PLUGINS[name]}, and nothing imports it`);
}
console.error(`
Either build the feature or remove the plugin from app.json. Shipping a purpose
string for a prompt that can never appear is what D-066 is about.
`);
process.exit(1);
