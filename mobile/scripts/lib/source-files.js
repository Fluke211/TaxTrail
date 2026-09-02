/*
 * Every file the app bundle can reach.
 *
 * One copy, because there were three and the reasoning below was only written
 * down in one of them.
 *
 * `check-ota-safety.js` used to walk `src/` plus a hardcoded
 * `['App.tsx', 'index.ts']`. D-071 renamed the entry point to `index.tsx` and
 * nothing updated the list, so for four commits the file that runs FIRST was
 * the one file that check skipped, and it still printed green (D-074).
 *
 * So: walk the project, name what is EXCLUDED, and let anything new be included
 * by default. The skip set is matched at the TOP LEVEL ONLY — matching those
 * names at every depth would silently drop a future `src/lib/android/` or
 * `src/screens/scripts/`, which is the same bug one directory further down.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SKIP = ['node_modules', 'ios', 'android', '__tests__', 'scripts', '.expo'];

/**
 * @param {string} root  the mobile/ directory
 * @returns {string[]} absolute paths to every .ts/.tsx/.js/.jsx the bundle can reach
 */
function sourceFiles(root) {
  const out = [];
  const skip = new Set(SKIP);
  (function walk(dir) {
    // withFileTypes: one syscall per entry, and a dangling symlink is reported
    // as a symlink rather than throwing ENOENT out of statSync.
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (dir === root && skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.isFile()) continue;
      if (/\.(ts|tsx|js|jsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(full);
    }
  })(root);
  return out;
}

module.exports = { sourceFiles, SKIP };
