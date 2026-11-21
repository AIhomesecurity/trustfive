# TrustFive overnight and daily agent operating rota

Established 19 November 2026. This documents the ChatGPT recurring tasks; it does **not** install a continuously running server, modify GitHub Actions cron, or guarantee a run succeeds.

## Active scheduled lanes (Europe/London; winter GMT)
- Main development (existing): hourly around xx:57, automation `6aff2ef5a9c4819181b1ace0bd2b2dd1`. Owns the highest-priority product feature, integration work, PR #1 and master issue #12.
- CI, privacy and security (new): hourly at xx:17 during 00:00–08:59, automation `6aff8685621c8191a89a5748409e6d96`. Owns failing database/web checks, guarded SQL privileges and negative regression tests, not duplicate product features.
- Original mobile UX and neighbourhood community work (new): hourly at xx:37 during 00:00–08:59, automation `6aff8687750c8191b87825f37fa0f2e4`. Owns mobile/a11y/discovery/community slices, not backend/security rewrites.
- Lovable credit and saved-work handoff (new): daily at 10:10, automation `6aff869b1e248191aeda74bd202d7550`. Inspects the connected workspace and already saved Lovable source; ports complete safe pieces to canonical Next.js GitHub branch. **No new generation if no verifiable credits/no-extra-charge allowance.**
- Independent competitor/quality audit (existing): daily around 17:58, automation `6aff38b174b08191b2368d63161740b1`, may identify high-impact backlog tasks and inspect product quality.

Each automation has a minimum one-hour recurrence; staggered lanes do not imply an agent runs continuously. Execution, external-tool availability and schedules can vary.

## Canonical source and checkpoints
Repository: https://github.com/AIhomesecurity/trustfive
Branch: `feature/verified-marketplace-core`
Review: PR #1, draft.
Authoritative task checklist: https://github.com/AIhomesecurity/trustfive/issues/12

1. Start by inspecting the latest GitHub HEAD, CI and open issues, including recent agent commits; avoid duplicate efforts.
2. Select **one small independently useful change**, with acceptance criteria and least-privilege security. Scope it to fit a single run.
3. Check the current branch HEAD immediately before writing so parallel tasks do not overwrite one another. Prefer a separate PR/review branch if an incompatible edit is in flight.
4. Commit the tested source changes; capture exact GitHub SHA and workflow links, and add a checkpoint comment for any incomplete work. GitHub is the source of truth.
5. Update checklist items only for verified, committed features; distinguish CI green from live authenticated staging tests and launch readiness.
6. If blocked by insufficient credits, unavailable tooling, permissions or incomplete verification, preserve work, record blocker and pivot to an independent useful test/issue.

## Lovable budget and sync
At setup, Lovable workspace `8453b2b5125f11dd544a` reported **plan free**, while the owner described a paid £22/month plan. TrustFive Experience Lab `69558021-69b4-4166-b6be-ea01ba47fdb0` reported `needs_attention: out_of_credits` with saved code at commit `6568a914767a6f8777f0ae1e63ee7007aa9e2996`. There is no verified automatic GitHub sync. Review existing files and adapt complete UI code via a GitHub commit; do not assume daily reset timing, daily allowance, or the availability of paid usage. Don't call Lovable AI generation just to exhaust credits.

## Release guardrails
- Never merge into production, activate live billing, make a public launch, create paid resources, purchase services or change production domains without explicit owner approval.
- Maximum **five** independently vetted, active professionals **per trade per verified geographical territory**, fair waitlists and independent ranking unaffected by payment.
- Keep customer addresses/coordinates and professional verified service points private; exact booking address sharing only with customer's permission.
- Don't seed fake verified businesses, accounts, ratings or completed-job reviews as genuine customer data.
- Do not copy competitors' protected designs, private data or code. Prototype/placeholder data must be labeled.
- No claim of an app being fully complete until genuine signup → discovery → address → quote → booking → payment-test → completion → review, professional vetting and community moderation are verified in authorised staging, followed by explicit production approval.
