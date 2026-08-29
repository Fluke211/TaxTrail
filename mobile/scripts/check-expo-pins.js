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
 */
const ALLOWED = {
  // @expo/vector-icons@15 depends on expo-font@57, which npm hoists to the top
  // level; `expo` itself keeps its own nested copy at the pinned 55.0.8, so the
  // native module the SDK links is the right one and 57 is only a JS consumer
  // of the API. This exact arrangement was in the tree for build 3, which built
  // and shipped, so it is proven rather than assumed.
  'expo-font': 'nested 55.0.8 for expo itself; top-level 57.0.1 shipped in build 3',
};

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
