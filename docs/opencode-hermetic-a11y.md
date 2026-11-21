# OpenCode hermetic browser CI and address-picker a11y fix

Branch: `agent/opencode-hermetic-a11y`, from `feature/verified-marketplace-core`
@ `6813699`. Independent draft PR; no production merge or deployment.

## Changes

1. `app/coverage/page.tsx`: render the anonymous sign-in link whenever the
   session is not known to be signed in, instead of waiting for the Supabase
   auth request to settle. Static anonymous-copy assertions no longer depend on
   a live auth round trip; the register button remains disabled while loading or
   anonymous.
2. `components/address-search.tsx`: implement the ARIA combobox/listbox pattern:
   `role="combobox"`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`,
   `aria-controls`, `aria-expanded`, `aria-activedescendant`, unique option IDs,
   `aria-selected`, and ArrowDown/ArrowUp/Enter/Escape/Tab handling. Mouse hover
   also tracks the active option.
3. `tests/e2e/address-picker-keyboard.spec.ts`: deterministic regression test
   using a routed `/api/address/search` fixture (no paid provider call) that
   checks expansion, active option, Enter selection, Escape dismissal and the
   combobox attributes.
4. `package-lock.json` and `.gitignore`: reproducible install for this isolated
   branch.

## Verification

- `npm ci --no-audit --no-fund`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- Focused coverage + address-picker tests: **3 passed**
- Full Playwright suite: **102 passed / 0 failed / 4 opt-in staging skips**. The
  former `uk-coverage-release-gates.spec.ts:4` environment-dependent failure is
  now fixed, and no retry was used locally.

The four remaining skips require private authenticated staging storage state;
they were not counted as passes. No live Supabase project, third-party geocoder,
paid API or production route was used.
