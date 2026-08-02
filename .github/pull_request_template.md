## What changed

<!-- One or two sentences. What does this do? -->

## Why

<!-- The reasoning. If this is a non-obvious choice, add an entry to DECISIONS.md
     and link it here instead of explaining twice. -->

## Verification

<!-- What you actually ran, and its output. Not "should work" — what you observed.
     Delete rows that don't apply. -->

- [ ] `cd mobile && npm run test:unit` — 10 passed, 0 failed
- [ ] `npx tsc --noEmit` — clean
- [ ] CI preflight (`step: build`, `confirm_build` empty) — expo-doctor 19/19, prebuild succeeds
- [ ] `Info.plist` permissions re-inspected (required after any config-plugin change)

## Build impact

<!-- Delete the ones that don't apply. -->

- [ ] JS-only — ships via `eas update`, no build required
- [ ] Adds/changes a native dependency — **requires a build**
- [ ] Changes entitlements — **requires a build AND credential regeneration** (see D-011)
- [ ] `JS_REVISION` bumped
- [ ] `APP_BUILD` bumped

## Docs

- [ ] `STATUS.md` updated if this changes where the project stands
- [ ] `DECISIONS.md` entry added if a non-obvious choice was made
- [ ] `CHANGELOG.md` updated if a version changed
