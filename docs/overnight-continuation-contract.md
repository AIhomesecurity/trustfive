# TrustFive overnight continuation contract (20–21 Nov 2026)

## Primary instruction to every agent
Act as a code-producing engineer, not a status-reporting agent. Treat GitHub `AIhomesecurity/trustfive`, `feature/verified-marketplace-core`, draft PR #1 and master issue #12 as the source of truth. Read `AGENTS.md` and this file before each work session. **Do not claim success from a green workflow if it produced no code or failed to pass CI.**

### Self-continuing execution loop
1. Check current branch HEAD, outstanding draft `agent/*` PRs, CI, project issue #12, preview commit SHA, Supabase health. Load prior checkpoints; don't restart already finished work.
2. Select the highest-priority **independent** undone task from the backlog whose files no other active lane owns. Security > completed authenticated customer journey > critical customer/pro CRM > community/mobile polish. Avoid retrying inaccessible external platforms.
3. Implement original source, a relevant regression test, and docs only where necessary. Test changed scope; never skip or falsely report failed checks.
4. Commit to `feature/verified-marketplace-core` only for ChatGPT-integrated owned work. External local/hosted CLI agents must use distinct `agent/<provider>-<task>` branches and submit DRAFT PRs against the feature branch. Never merge into production.
5. Review exact SHA against CI; if failing, fix and recommit before starting a new unrelated task.
6. Write one compact checkpoint: SHA, changed files, tests and outcomes, preview SHA/URL if verified, blockers and top next task. **Immediately choose the next independent task and repeat for as much of the permitted current execution window as tools and remaining allowance allow.**
7. If the session must stop for time, quota, or tool access, leave one reproducible next-step command/instruction in issue #12 and a clean commit/PR. Don't say work is still ongoing after the executor stopped.

### Quantitative targets (goals, never fabricated guarantees)
- Use as much of each *actual* run's available execution budget as safely practical, leaving room for tests, checkpoints and clean termination; **do not claim a 4-hour runtime when no such continuous execution window is available**.
- Aim for at least one complete tested slice per productive coding run; continue to more slices only when remaining budget allows.
- No call or task is allowed to incur **new paid usage** or activate a paid fallback unless owner later explicitly approves specific spend.
- No live payments, production merges, professional approvals without review, fake businesses or reviews, secret disclosure, storing private customer addresses in logs or sending them to external models.
- Any zero-code run MUST report `NO_CODE_CHANGE` with a plain reason, not `AGENT_SUCCEEDED`.
- Prefer small actionable source changes to repeated architecture plans or duplicated reports.

## Free-tier lane allocation (verify in each account; public ceilings are not guarantees)
| Lane | Public information | Safe use and checkpoint |
| --- | --- | --- |
| **Codex using ChatGPT login** | Included but variable personal 5-hour and weekly windows; check actual allowance via `/status` or Codex Settings → Usage. No fixed number can be inferred from plan. | If locally authenticated, use the **existing app/CLI**, not the GitHub Actions OpenAI API key (that is pay-as-you-go). Choose one isolated task per session and draft PR. This chat has no direct access to the owner's local process. |
| **Codex GitHub Actions** | API-key requests can incur separate charges; GitHub connector permission is not a token allowance. | Manual credential-presence checks only until paid inference explicitly authorised. No automated spend. |
| **OpenCode / OpenRouter :free** | OpenRouter publishes **20 free requests/minute and 50/day** for accounts without a qualifying previous credit purchase; 1,000/day only after account purchase threshold, not assumed. Failed requests can count. Actual key, provider and per-model limits can be tighter. | Existing runner uses `openrouter/openrouter/free`; no paid fallback. On free daily quota refusal, abort that lane quickly and never hammer retries. Treat missing PR as no code generated. Local OpenCode may use a different provider and allowance—verify its own `/status` or provider dashboard. |
| **Gemini CLI Google login** | Official Gemini CLI documentation states **1,000 model requests/day, 60/min** for individual Google sign-in, subject to eligibility/current account limits. Separate **unpaid Gemini API key** route documented as 250/day, 10/min on Flash. | Prefer local Google-sign-in CLI for large free work, but first verify working authenticated model, quota and ability to create isolated GitHub PR. Existing GitHub Gemini API action previously failed HTTP 404 and is opt-in only; cannot assume it works or is free on this key. |
| **Hermes Agent** | Free/open-source software, NOT free unmetered hosted inference. Nous Portal free options and caps vary by account. | If installed/authenticated to an eligible genuinely free provider or local model, take one independent repo task and submit a draft PR. Don't assume Hermes is available from this chat. |
| **Lovable** | Credits depend on workspace, plan, regional grants and balance. Pro workspace was verified, but actual current available credits are not exposed here. | Read existing Trade Finder source and port cleanly (demo businesses excluded). Do not trigger generation just to consume credits or use paid per-call inference. |
| **AionUI** | Orchestrator of local agents, **no distinct model quota**. | Delegate to Codex/OpenCode/Gemini/Hermes only when separately authenticated. Separate branches, files and PRs. |
| **ChatGPT scheduled tasks** | The available automation scheduler permits at most **hourly** runs and each run has its own execution budget; not an unbroken 4-hour or 8-hour process. | Existing hourly development, hourly overnight security and hourly overnight UX tasks cover independent lanes. Within each run, follow this self-continuing loop. |

## File ownership to avoid parallel collisions
- Main development: customer jobs → quote → booking lifecycle; check PR/head before writing. Tests for those flows.
- Security: `tests/db/`, narrowly scoped SQL/RLS, `docs/security/`.
- Mobile/UX: `app/community/`, scoped component styles and accessibility tests; do not edit `app/jobs/page.tsx` while main dev owns it.
- Local Codex: independent `agent/codex-*` branch with one bounded workflow or test.
- Local Gemini: `agent/gemini-*` security audit or typed tests that do not clash with security lane.
- Local OpenCode: `agent/opencode-*` standalone UX or community function; earlier local PR #14 created `agent/aionui-customer-journey` and passed CI; proof of GitHub handoff, not proof of direct control.
- Hermes: `agent/hermes-*` documentation/tooling/test fixes only if verified running and authorised.

## Nightly checkpoints
At every run, distinguish: (a) **configured**; (b) **authenticated**; (c) **actually ran**; (d) **code produced**; (e) **tests passed**; (f) **accepted on staging**. Neither a GitHub app installation nor a green build alone satisfies all six. Summarise evidence the next morning. Do not claim a finished worldwide marketplace without authorised vetted professionals and complete end-to-end acceptance.
