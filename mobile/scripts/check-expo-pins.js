#!/usr/bin/env node
/*
 * Does every native dependency match the version this Expo SDK was built with?
 *
 * `npx expo install` normally guarantees this, but it resolves versions through
 * api.expo.dev — which is blocked from Claude Code remote sessions (CLAUDE.md),
 * so packages get added here with plain `npm install` and a version read out of
 * `expo/bundledNativeModules.json` by hand.
 *
 * That worked for the three modules added for build 4 and still produced a
 * broken build, because npm quietly pulled in a FOURTH: react-native-worklets
 * arrived as a transitive peer of reanimated at 0.8.3, while Expo SDK 55 pins
 * 0.7.4. The build failed in "Install pods" with an unknown error, and the
 * expo.dev log that would have named it is unreachable from here.
 *
 * A hand-check catches the packages you thought about. This catches the ones
 * you didn't.
 *
 *   node scripts/check-expo-pins.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pinned = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'node_modules/expo/bundledNativeModules.json'), 'utf8'));
const deps = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).dependencies || {};

/** Does an installed version satisfy the range Expo pins? Only the three forms
 *  bundledNativeModules.json actually uses: exact, ~minor, ^major. */
function satisfies(installed, range) {
  const base = range.replace(/^[~^]/, '');
  const a = installed.split('.');
  const b = base.split('.');
  if (range.startsWith('~')) return a[0] === b[0] && a[1] === b[1];
  if (range.startsWith('^')) return a[0] === b[0];
  return installed === base;
}

/*
 * Known-good divergences.
 *
 * A package listed here resolves outside the SDK's pin but has actually
 * shipped in a successful build, so failing on it would block every PR for a
 * condition we have proof is fine. Each entry needs that proof, not a hunch.
 *
 * EMPTY, AND THAT IS THE POINT. The one entry this ever held said expo-font
 * 57.0.1 at top level was fine because "the native module the SDK links is the
 * right one and 57 is only a JS consumer of the API". That was backwards:
 * autolinking links the TOP-LEVEL copy, so builds 4 and 5 compiled expo-font 57
 * against expo-modules-core 55, ExpoFontLoader never registered, and the app
 * died on launch for four days (D-072).
 *
 * The entry also justified itself with "shipped in build 3, which built and
 * shipped, so it is proven rather than assumed" — conflating *built* with
 * *ran*. Before adding anything here, say which device ran it.
 */
const ALLOWED = {
};

/*
 * A SECOND check, and the one that would have caught D-072 on day one.
 *
 * The pin check above compares the TOP-LEVEL install against the SDK's pin. It
 * cannot see the real hazard, which is the same native package present TWICE at
 * different majors — one hoisted to the top by a loose peer range, one nested
 * under `expo` at the pinned version. Autolinking compiles exactly one of them,
 * and it takes the hoisted one. So the app links a native module built for a
 * different SDK, the build succeeds, and the module never registers at runtime.
 *
 * That is not a version-drift problem, it is a duplication problem, and nothing
 * here was looking for duplication.
 */
function duplicatedNativePackages() {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return [];
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const byName = new Map();
  for (const [p, meta] of Object.entries(lock.packages || {})) {
    if (!p.startsWith('node_modules/') || !meta.version) continue;
    const name = p.slice(p.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(meta.version);
  }
  const dupes = [];
  for (const [name, versions] of byName) {
    if (versions.size < 2) continue;
    // Only native ones matter: a duplicated pure-JS package is wasteful, not fatal.
    const autolinks = fs.existsSync(
      path.join(ROOT, 'node_modules', name, 'expo-module.config.json'));
    if (autolinks) dupes.push({ name, versions: [...versions].sort() });
  }
  return dupes;
}

const dupes = duplicatedNativePackages();
if (dupes.length) {
  console.error('\nA native package is installed at more than one version:\n');
  for (const d of dupes) {
    console.error(`  ${d.name}  ${d.versions.join('  and  ')}`);
  }
  console.error(`
Autolinking compiles ONE of these — the hoisted top-level copy — so the binary
gets a native module built for a different SDK. It links, it builds, and then
the module is simply absent at runtime. That is D-072, and it cost four days.

Fix it with an "overrides" entry in package.json pinning the package to the
version this SDK expects, then re-run npm install.
`);
  process.exit(1);
}

const problems = [];
const checked = [];
const allowed = [];

// Walk everything actually installed, not just what package.json declares —
// a transitive native module is exactly the case that broke build 4.
const modulesDir = path.join(ROOT, 'node_modules');
for (const name of Object.keys(pinned)) {
  const pkgPath = path.join(modulesDir, name, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;   // not installed: nothing to check
  const installed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  const range = pinned[name];
  const direct = Object.prototype.hasOwnProperty.call(deps, name);
  checked.push(name);
  if (satisfies(installed, range)) continue;
  if (ALLOWED[name]) { allowed.push({ name, installed, range }); continue; }
  problems.push({ name, installed, range, direct });
}

console.log(`Checked ${checked.length} Expo-pinned packages against what is installed.`);
for (const a2 of allowed) {
  console.log(`  allowed: ${a2.name} ${a2.installed} (pin ${a2.range}) — ${ALLOWED[a2.name]}`);
}

if (!problems.length) {
  console.log('All match the versions this SDK was built with.');
  process.exit(0);
}

console.log('');
for (const p of problems) {
  console.log(`::error::${p.name} is ${p.installed} but Expo SDK pins ${p.range}` +
    (p.direct ? '' : ' (pulled in as a transitive dependency, not declared in package.json)'));
  console.log(`    fix:  npm install --save-exact ${p.name}@${p.range.replace(/^[~^]/, '')}`);
}
console.log('');
console.log('A version outside the set the SDK was built with is how a build dies in');
console.log('"Install pods" with an error you cannot read from here.');
process.exit(1);
