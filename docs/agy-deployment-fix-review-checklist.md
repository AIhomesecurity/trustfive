# AGY Deployment Fix — Review Checklist

When AGY's local commit is pushed to a branch, run through this checklist.

## How to find AGY's fix

AGY committed the fix on the operator's local PC. To get it into GitHub:

```powershell
git log --oneline --all --grep="deploy\|cloudflare\|worker\|build" | head -20
git branch -a | grep -iE "agy|deploy|cloudflare"
```

Once you find the commit SHA:

```powershell
git checkout <commit-sha>
git checkout -b agent/agy-deployment-fix
git push -u origin agent/agy-deployment-fix
```

## Review checklist

### 1. What does the fix change?
- [ ] Commit message states what was broken and what was fixed.
- [ ] Diff is minimal — no unrelated changes.
- [ ] If it modifies cloudflare.config.ts, wrangler.toml, or package.json, the change is explained.

### 2. Does the fix match the reported problem?

AGY reported: "Cloudflare is serving the older build." Likely root causes:
- [ ] Build output not uploaded (wrong directory in wrangler.toml).
- [ ] Cache invalidation (stale Worker on edge).
- [ ] Wrong branch deployed.
- [ ] Commit SHA not embedded in health endpoint.

### 3. Do the 23 release tests pass?

```bash
npm install && npm run build
bash tests/release/cloudflare-worker-smoke.sh
node tests/release/signed-in-smoke.mjs 3008
```

- [ ] All 23 release tests pass on the combined build.
- [ ] Cloudflare Worker smoke test passes.
- [ ] Signed-in smoke test passes.

### 4. Does the health endpoint report the commit SHA?

```bash
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://trustfive-preview.example.workers.dev/api/health
```

Response must include `"commit":"<full-sha>"`.

### 5. Does CI pass on the combined build?
- [ ] Push branch to GitHub.
- [ ] Open draft PR against `agent/chatgpt-release-booking-social-1123`.
- [ ] Both workflows pass: `TrustFive checks` + `TrustFive database integration`.

### 6. Rollback plan

```bash
npx wrangler deployments rollback
# Or delete the branch:
git push origin :agent/agy-deployment-fix
```

## What I need from you

I cannot reach AGY's local commit. You need to:
1. Find the commit on your PC.
2. Push it to a branch on GitHub.
3. Tell me the branch name.

Once I have the branch name, I can read the diff via the GitHub plugin and run the checklist.
