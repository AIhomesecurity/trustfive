# UK Regional & Ward Coverage Reconciliation Proposal (Read-Only)

## Purpose & Strict Boundaries
TrustFive separates **UK-wide searchable geography** from **human-reviewed five-slot operating territories**:

- **UK-wide searchable (`UK_WIDE_SEARCHABLE_ONLY`)**: Any full UK postcode or outward postcode district across England, Scotland, Wales and Northern Ireland can be searched via `postcodes.io` (centroid precision only — never presented as an exact street address) and logged as a pending coverage-interest request on `/coverage`.
- **Human-reviewed five-slot territory (`UNREVIEWED_PROPOSAL_ONLY` until independent sign-off)**: Searching or proposing an official ONS/NRS/OSNI ward or local authority district **never** marks a territory as reviewed, **never** opens active five-slot places (`activeProfessionalSlotCap: 0`), and **never** approves or fabricates professionals.

## Running the Read-Only Reconciliation Proposal Tool
```bash
node scripts/geo/propose-uk-coverage-reconciliation.mjs <official-manifest.json> [reviewed-snapshot.json]
```

The script performs zero network calls and zero database writes. It fails closed (`exit 3`) if:
- Licence metadata is missing or not an approved UK open government licence (`OGL-UK-3.0`, `Open Government Licence v3.0`, `OS OpenData Licence`).
- Provenance is incomplete (`publisher`, `datasetId`, `version`, `retrievedAt`, trusted HTTPS `sourceUrl`, or matching 64-char `sourceSha256`).
- Any GSS code is outside the four UK constituent nations (`E05`/`E06`/`E07`/`E08`/`E09`/`E12`, `S12`/`S13`, `W05`/`W06`, `N08`/`N09`) or duplicated.

Each accepted entry is reconciled against an optional read-only snapshot of previously reviewed territories and tagged as `NEW_UNREVIEWED_CANDIDATE`, `MATCHES_REVIEWED_VERSION`, `VERSION_DRIFT_REQUIRES_RE_REVIEW`, `NAME_DRIFT_REQUIRES_RE_REVIEW`, or `RETIRED_OR_MISSING_FROM_SOURCE`.

## Missing Owner Actions Required Before Any Territory Launch
This tooling intentionally cannot perform or grant owner-only sign-offs. The following actions remain required from the project owner:

| Area | Missing Owner Action | Current Status |
| --- | --- | --- |
| Official territory boundaries | Download authoritative ONS/NRS/OSNI polygons, verify via `scripts/geo/inspect-boundary-geojson.mjs`, and record independent human GIS/boundary review per territory. | **Pending owner/GIS review** |
| Genuine five-slot professional vetting | Independently verify real applicant credentials, insurance, identity and local eligibility for up to 5 active professionals per trade per approved territory (zero paid placement or synthetic listings). | **Pending independent vetting** |
| Legal, privacy & payment sign-off | Owner approval of country release terms, GDPR/private-address retention controls, and Stripe live-mode transition (kept strictly in test mode until approved). | **Pending owner approval** |
| Staging signed-in E2E credentials | Supply private local `TRUSTFIVE_CUSTOMER_STORAGE_STATE` + `TRUSTFIVE_STAGING_ACCEPTANCE=1` outside Git when running opt-in signed-in staging acceptance (`tests/e2e/uk-coverage-signed-in-acceptance.spec.ts`). | **Optional per staging run (skipped safely when absent)** |
