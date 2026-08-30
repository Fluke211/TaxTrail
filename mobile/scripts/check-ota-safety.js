#!/usr/bin/env node
/*
 * Could this JS brick a binary that is already in someone's hands?
 *
 * An `eas update` reaches EVERY installed binary whose runtimeVersion matches,
 * and this app's runtimeVersion policy is `appVersion` — so every build of
 * v1.0.0 gets every update. A binary only contains the native modules that were
 * in package.json when IT was compiled. Ship JS that statically imports a module
 * an older binary lacks and that binary throws at startup, before any of its own
 * code runs.
 *
 * That is not a hypothetical. Build 4 shipped with `GestureHandlerRootView`
 * imported at module scope in App.tsx and crashed on launch (D-062), and the
 * same `main` would have taken build 3 down with it — build 3 has neither
 * gesture-handler nor expo-mail-composer, both of which tonight's work imports
 * statically.
 *
 * expo-updates has a recovery pipeline for exactly this, but it needs somewhere
 * to fall back TO. A fresh install running only its embedded bundle has nothing,
 * so the crash is terminal until the user reinstalls. That is the failure this
 * check exists to prevent.
 *
 * THE RULE
 *   A native module that is not present in every live binary may never appear
 *   in a static `import`. It has to be reached through a guarded require inside
 *   a function, so the failure is a hidden control rather than a dead app —
 *   the `isRestoreAvailable()` pattern in exportShare.ts.
 *
 *   node scripts/check-ota-safety.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/*
 * Which native modules each binary that is OUT THERE actually contains.
 *
 * Committed as data rather than derived, because the point is what shipped, and
 * that is a historical fact about a binary on someone's phone — not something
 * the current tree can be asked. Read from `package.json` at each build's own
 * commit when the entry was added.
 *
 * Add a row when a build is submitted. Remove one only when that build can no
 * longer be running anywhere, which for TestFlight means expired (90 days) and
 * for the App Store means never.
 */
const LIVE_BUILDS = [
  {
    build: 3,
    commit: '0b00b937',
    note: 'TestFlight. Was the fallback during the build 4 crash (D-062).',
    modules: [
      '@react-native-async-storage/async-storage', 'expo-camera', 'expo-clipboard',
      'expo-dev-client', 'expo-document-picker', 'expo-file-system', 'expo-haptics',
      'expo-image-manipulator', 'expo-image-picker', 'expo-local-authentication',
      'expo-location', 'expo-print', 'expo-sharing', 'expo-sqlite', 'expo-status-bar',
      'expo-store-review', 'expo-text-extractor', 'expo-updates',
      'react-native-document-scanner-plugin', 'react-native-purchases',
      'react-native-purchases-ui', 'react-native-safe-area-context',
    ],
  },
  {
    build: 4,
    commit: 'fba11d5',
    note: 'TestFlight. Adds gesture-handler, reanimated, worklets, mail-composer. '
      + 'Embeds js r22, which does NOT launch — fresh installs crash (D-067).',
    modules: [
      '@react-native-async-storage/async-storage', 'expo-camera', 'expo-clipboard',
      'expo-dev-client', 'expo-document-picker', 'expo-file-system', 'expo-haptics',
      'expo-image-manipulator', 'expo-image-picker', 'expo-local-authentication',
      'expo-location', 'expo-mail-composer', 'expo-print', 'expo-sharing', 'expo-sqlite',
      'expo-status-bar', 'expo-store-review', 'expo-text-extractor', 'expo-updates',
      'react-native-document-scanner-plugin', 'react-native-gesture-handler',
      'react-native-purchases', 'react-native-purchases-ui', 'react-native-reanimated',
      'react-native-safe-area-context', 'react-native-worklets',
    ],
  },
];

/* Packages that ship no native code, so every binary can run them whatever it
 * was compiled with. Pure JS or bundled assets only. */
const PURE_JS = new Set([
  'react', 'react-dom', 'react-native', 'xlsx', 'jszip', '@expo/vector-icons', 'expo',
]);

/** Every file the app bundle can reach. */
function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  for (const f of ['App.tsx', 'index.ts']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

/** The package a specifier belongs to: 'expo-file-system/legacy' -> 'expo-file-system',
 *  '@scope/pkg/sub' -> '@scope/pkg'. Relative paths return null. */
function packageOf(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/')) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

// Static imports only. `import` is hoisted and always evaluated at module load,
// which is precisely what makes it dangerous here; a require() inside a function
// is not, and is the sanctioned escape hatch.
const IMPORT_RE = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

const files = sourceFiles();
const findings = [];
const seen = new Map();      // package -> [files]

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const pkg = packageOf(m[1]);
    if (!pkg || PURE_JS.has(pkg)) continue;
    if (!seen.has(pkg)) seen.set(pkg, []);
    const rel = path.relative(ROOT, file);
    if (!seen.get(pkg).includes(rel)) seen.get(pkg).push(rel);
  }
}

for (const [pkg, where] of [...seen.entries()].sort()) {
  const missingFrom = LIVE_BUILDS.filter((b) => !b.modules.includes(pkg));
  if (missingFrom.length) findings.push({ pkg, where, missingFrom });
}

console.log(`Live binaries: ${LIVE_BUILDS.map((b) => `build ${b.build}`).join(', ')}`);
console.log(`Statically imported non-pure-JS packages: ${seen.size}`);

if (!findings.length) {
  console.log('\nEvery statically imported native module exists in every live binary.');
  console.log('This JS is safe to publish as an OTA update.');
  process.exit(0);
}

console.log('');
for (const f of findings) {
  const builds = f.missingFrom.map((b) => `build ${b.build}`).join(' and ');
  console.log(`::error::${f.pkg} is imported statically but is NOT in ${builds}.`);
  for (const w of f.where) console.log(`      imported by: ${w}`);
  console.log(`      Publishing this JS would crash ${builds} on launch, with no way`);
  console.log('      back for anyone whose only bundle is the embedded one.');
  console.log('      Fix: reach it through a guarded require inside a function and hide');
  console.log('      the control when it is absent — see isRestoreAvailable() in');
  console.log('      src/lib/exportShare.ts — or drop the feature until every live');
  console.log('      binary carries the module.');
  console.log('');
}
console.log('If a new build has since shipped with these modules, add it to LIVE_BUILDS');
console.log('in this file. Do not weaken the rule to make a publish go through.');
process.exit(1);
