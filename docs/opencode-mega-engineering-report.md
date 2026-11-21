# OpenCode mega engineering challenge — running report

Base of record: `feature/verified-marketplace-core` @ `995f9d0b3c3d477d36c2e5ba0ab899170082c1d4`.

This file is updated at every milestone. It is deliberately kept in the branch rather than only in an issue so the evidence survives independently of GitHub notifications.

## Scope guardrails

- No production merges, no direct pushes to `feature/verified-marketplace-core` or `main`.
- No changes to other agents' branches (`agent/agy-bookings-quotes`, `agent/gemini-professional-onboarding`, `agent/chatgpt-events-discovery-upgrade`, existing PR #26).
- No SQL/RLS changes in this slice. No payment, ranking or approval changes.
- Max-five independently approved active professionals per trade per defined area remains enforced in the database.

## Milestone 1 — repository audit + ESLint repair

### Audit status

Full architecture/security/test/PR audit is in progress and will be appended here with file-and-line evidence before this slice is finalised.

### ESLint repair (Phase 2)

**Problem.** `npm run lint` invoked `eslint .` but ESLint was not a declared dependency and there was no configuration, so the command failed on every machine and in CI (which did not call it). The repository also had no `package-lock.json`, while CI used `npm install`, so builds were not reproducible.

**Changes.**

- Added ESLint 9 flat configuration in `eslint.config.mjs`. The official Next.js 15 presets (`next/core-web-vitals`, `next/typescript`) are converted with `@eslint/eslintrc` `FlatCompat` because `eslint-config-next` 15.x still ships legacy eslintrc presets. These provide React, React Hooks, Next.js and TypeScript rules.
- Added focused `eslint-plugin-jsx-a11y` rules (alt text, valid anchors, ARIA props/roles/states, heading content, lang, iframe titles, scope, no redundant roles, no distracting elements, autofocus warning).
- Added `eslint-baseline.mjs` with an **empty** baseline array. No rule was globally disabled and no violation was baselined.
- Fixed all 15 reported violations instead of suppressing them:
  - 11 unescaped apostrophes in JSX copy (admin territories, billing, events, coverage, jobs, messages, schedule).
  - 2 unused variables (`catch(e)` in events, dead `updateArea` helper in services).
  - 1 invalid ARIA combination: the address input carried `aria-expanded` with an implicit `textbox` role; it now declares `role="combobox"` and `aria-autocomplete="list"`.
  - 1 `<img>` logo replaced with `next/image` (`unoptimized` for the local SVG so the image optimiser does not reject it).
- Added `package-lock.json` and switched CI from `npm install` to `npm ci --no-audit --no-fund`.
- Added an explicit `Lint source and tests` step to `.github/workflows/ci.yml` before type-checking and build.
- Ignored generated `next-env.d.ts` and lint scratch output.

**Verification on this commit.**

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS (319 packages installed from lockfile) |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

Initial lint baseline before fixes: 15 messages (12 errors, 3 warnings) across 10 files. All were corrected; no baselined or globally disabled rules.

### Next milestone

Independent behavioural tests for the customer search-to-job journey and security/privacy stress tests, on a new `agent/opencode-mega-*` branch based on the latest integration tip.
