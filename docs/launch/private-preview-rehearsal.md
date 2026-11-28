# TrustFive private preview rehearsal

Use the dedicated `trustfive-preview` Worker and `https://preview.trustfive.co.uk`.
Leave the live Worker and its database untouched. Before rehearsal, confirm the
preview custom hostname is behind Cloudflare Access and alternate Worker URLs
are disabled or protected. The preview database must contain synthetic data only.

## Preflight

### Repeatable CI artifact build

Do not depend on a developer or chat session having a build environment. The **TrustFive protected preview artifact** GitHub Actions workflow runs
on every update to `feature/verified-marketplace-core` (or can be started
manually from the Actions tab). It runs the reusable database replay and
security contracts, app/browser checks, builds the Worker against the isolated
preview Supabase project, checks browser-asset isolation, and stores the exact
`.cloudflare/output/v1` artifact for 30 days under the full candidate SHA.
Download that artifact without rebuilding it; the `artifact-manifest.json`
must name the same SHA and protected preview hostname. The workflow fails
closed if the preview/production Supabase variables are missing or overlap.

Set these repository variables once under **Settings → Secrets and variables →
Actions → Variables**:

- `PREVIEW_SUPABASE_URL` = `https://niyfvoxiagvbonifuctv.supabase.co`
- `PREVIEW_SUPABASE_PUBLISHABLE_KEY` = the preview project's publishable key
- `PRODUCTION_SUPABASE_URL` = the production project's Supabase URL

The Cloudflare deployment still uses the protected gate below; the build
workflow does not publish anything or touch production.

1. Pin a full Git commit. Confirm the application, browser and PostgreSQL CI
   checks for that candidate. Build that checkout with its preview Supabase URL
   and publishable key and with `TRUSTFIVE_BUILD_SHA` set to the full commit.
2. Compare the candidate migration filenames and checked SQL with the isolated
   database's recorded migrations. Resolve gaps under preview-only approval
   before running fixture writes. Run
   `scripts/release/preview-schema-readiness.sql` read-only and require every
   check to pass. A catalog pass is additional evidence alongside migration history.
3. Before uploading and after deployment, check the configured database URL
   against the actual browser assets. Set `WORKER_RUNTIME_SUPABASE_URL` from
   the planned binding before upload, then from the active Cloudflare version
   after deployment. Obtain `PRODUCTION_SUPABASE_URL` independently from live
   deployment configuration. Run `npm run build:vinext`, then use its browser
   asset directory with the release check:

   ```sh
   node scripts/release/check-preview-isolation.mjs \
     .cloudflare/output/v1/workers/default/assets
   ```

   The check reads `PREVIEW_SUPABASE_URL`, `PRODUCTION_SUPABASE_URL` and
   `WORKER_RUNTIME_SUPABASE_URL`. It supports canonical Supabase SaaS project
   URLs and fails if executable browser assets have no project URL or mention
   multiple projects. Record the evidence sources and the active version ID.
4. Dry-run the explicit protected preview deployment gate before any authorized
   upload. Only `trustfive-preview` and `https://preview.trustfive.co.uk` are
   permitted destinations; raw model output, unreviewed patches, stale or
   mismatched prebuilt artifacts, wrong targets/bindings, and accidental public
   URL exposure (`workersDev`, `previewUrls`, extra domains, or fetch triggers)
   are rejected. Authorized `--execute` requires fresh Access evidence for the
   **currently deployed baseline** (`--protected-preview-evidence`): record its
   full health SHA and Cloudflare version ID, plus the anonymous Access denial,
   authorized service-token success, and disabled alternate URLs. The baseline
   SHA is expected to differ from the candidate before upload; candidate SHA is
   checked from the isolated prebuilt artifact here and against `/api/health`
   after upload. Never treat an old baseline as an eligible rollback unless its
   database binding and schema compatibility are independently verified.
   Authorized execution deploys ONLY the verified prebuilt
   `.cloudflare/output/v1` artifact using the installed Cloudflare CLI
   (`cf deploy --prebuilt --mode production --worker trustfive-preview --no-provision --tag EXPECTED_COMMIT_SHA`) without rebuilding:

   ```sh
   node scripts/release/deploy-preview-gate.mjs \
     --dry-run \
     --worker trustfive-preview \
     --hostname https://preview.trustfive.co.uk \
     --source-kind reviewed_commit \
     --commit EXPECTED_COMMIT_SHA \
     --build-output-root . \
     --evidence path/to/review-evidence.json \
     --protected-preview-evidence path/to/protected-preview-evidence.json
   ```

   Local Ollama runs must use `scripts/agent/ollama-handoff.mjs` so every
   attempt records its patch/commit or failure status, originating SHA, test
   evidence and destination in the coordinator inbox (`events.jsonl` and
   `reports/`), with GitHub draft PR eligibility restricted to independently
   reviewed passing commits and zero direct model-output deployments.

5. With credentials limited to this Access application, run
   `node scripts/release/validate-preview.mjs EXPECTED_COMMIT_SHA`.
   Supply `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` through the
   environment. Record the anonymous denial and the authenticated health check.
   Keep credentials out of evidence and logs.

## Rehearsal

- Use disposable customer, professional and unrelated identities. Check sign-in
  and recovery on the preview hostname, then job, quote, appointment, address
  sharing and revocation, completion and one verified review.
- Use separate Social memberships to check reporting, hide, dismiss and group
  isolation. Record pass, fail or blocked with exact commands and evidence for
  the deployed commit. Clean up the synthetic fixtures.
- Record the prior known-good isolated version and confirm its compatibility
  with the preview schema. Rehearse restoring that version on the preview Worker
  and repeat Access, health and sign-in checks before restoring the candidate.
  Record baseline, candidate and restored Worker version IDs and Git SHAs.
