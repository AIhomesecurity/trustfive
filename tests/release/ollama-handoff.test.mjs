import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {
  assertLocalOllamaEndpoint,
  buildHandoffRecord,
  canOpenGithubDraftPr,
  recordOllamaHandoffToInbox,
  redactSecrets,
  runGuardedOllamaAttempt,
} from '../../scripts/agent/ollama-handoff.mjs';

const originSha = '2'.repeat(40);
const commitSha = '3'.repeat(40);

async function makeInbox(t) {
  const dir = await mkdtemp(join(tmpdir(), 'trustfive-coord-inbox-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  return dir;
}

test('automatically records a local Ollama patch attempt, originating SHA, test evidence and destination in coordinator inbox', async t => {
  const inboxDir = await makeInbox(t);
  const {record, eventsPath, jsonReportPath, mdReportPath} = await runGuardedOllamaAttempt({
    attemptId: 'attempt-patch-001',
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen2.5-coder:7b',
    originatingSha: originSha,
    destination: {
      target: 'coordinator_inbox',
      branch: 'agent/ollama-local-review',
      baseBranch: 'feature/verified-marketplace-core',
    },
    inboxDir,
    executeAttempt: async () => ({
      patchContent: 'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
    }),
    runTests: async () => ({
      commands: ['node --test tests/release/*.test.mjs'],
      passed: true,
      summary: 'All release gate tests passed',
    }),
  });

  assert.equal(record.status, 'patch_recorded');
  assert.equal(record.originatingSha, originSha);
  assert.equal(record.artifact.kind, 'patch');
  assert.equal(record.testEvidence.passed, true);
  assert.equal(record.reviewState, 'unreviewed_model_output');
  assert.equal(record.destination.draftPrEligible, false);
  assert.equal(record.destination.deployEligible, false);

  const lines = (await readFile(eventsPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  const logged = JSON.parse(lines[0]);
  assert.equal(logged.attemptId, 'attempt-patch-001');
  assert.equal(logged.originatingSha, originSha);
  assert.equal(logged.destination.deployEligible, false);

  const patchText = await readFile(record.artifact.patchPath, 'utf8');
  assert.match(patchText, /diff --git/);
  assert.match(await readFile(jsonReportPath, 'utf8'), /"patch_recorded"/);
  assert.match(await readFile(mdReportPath, 'utf8'), /Direct Deploy Eligible:\*\* No/);
});

test('automatically records failure status and redacted error when local Ollama attempt fails', async t => {
  const inboxDir = await makeInbox(t);
  const {record, eventsPath} = await runGuardedOllamaAttempt({
    attemptId: 'attempt-fail-002',
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen2.5-coder:7b',
    originatingSha: originSha,
    destination: {target: 'coordinator_inbox'},
    inboxDir,
    executeAttempt: async () => {
      throw new Error('Ollama timeout with leaked sk_test_1234567890abcdef and CF-Access-Client-Secret=topsecretval');
    },
  });

  assert.equal(record.status, 'failed');
  assert.equal(record.originatingSha, originSha);
  assert.equal(record.testEvidence.passed, false);
  assert.equal(record.destination.draftPrEligible, false);
  assert.equal(record.destination.deployEligible, false);
  assert.doesNotMatch(record.error, /sk_test_1234567890abcdef|topsecretval/);

  const rawEvent = await readFile(eventsPath, 'utf8');
  assert.doesNotMatch(rawEvent, /sk_test_1234567890abcdef|topsecretval/);
});

test('rejects remote/paid Ollama endpoints fail-closed and still records rejection in coordinator inbox', async t => {
  const inboxDir = await makeInbox(t);
  assert.throws(() => assertLocalOllamaEndpoint('https://api.openai.com/v1'), /non-local/i);

  const {record} = await runGuardedOllamaAttempt({
    attemptId: 'attempt-remote-003',
    endpoint: 'https://paid-provider.example/api/generate',
    originatingSha: originSha,
    inboxDir,
    executeAttempt: async () => {
      throw new Error('Must never execute remote provider');
    },
  });

  assert.equal(record.status, 'rejected');
  assert.match(record.error, /non-local/i);
  assert.equal(record.destination.draftPrEligible, false);
  assert.equal(record.destination.deployEligible, false);
});

test('allows GitHub draft PR eligibility ONLY for reviewed passing commit on an agent branch targeting non-main base', async t => {
  const inboxDir = await makeInbox(t);
  const unreviewed = buildHandoffRecord({
    attemptId: 'attempt-commit-unreviewed',
    originatingSha: originSha,
    status: 'commit_recorded',
    reviewState: 'unreviewed_model_output',
    artifact: {kind: 'commit', commitSha},
    testEvidence: {commands: ['npx tsc --noEmit'], passed: true, summary: 'typecheck passed'},
    destination: {
      target: 'github_draft_pr',
      branch: 'agent/ollama-verified-slice',
      baseBranch: 'feature/verified-marketplace-core',
    },
  });
  assert.equal(canOpenGithubDraftPr(unreviewed), false);

  const toMain = buildHandoffRecord({
    attemptId: 'attempt-commit-main',
    originatingSha: originSha,
    status: 'commit_recorded',
    reviewState: 'reviewed_passing',
    artifact: {kind: 'commit', commitSha},
    testEvidence: {commands: ['npx tsc --noEmit'], passed: true, summary: 'typecheck passed'},
    destination: {
      target: 'github_draft_pr',
      branch: 'agent/ollama-verified-slice',
      baseBranch: 'main',
    },
  });
  assert.equal(canOpenGithubDraftPr(toMain), false);

  const {record: reviewedPassing} = await recordOllamaHandoffToInbox({
    attemptId: 'attempt-commit-reviewed-pass',
    originatingSha: originSha,
    status: 'commit_recorded',
    reviewState: 'reviewed_passing',
    artifact: {kind: 'commit', commitSha},
    testEvidence: {
      commands: ['npx tsc --noEmit', 'npm run build', 'node --test tests/release/*.test.mjs'],
      passed: true,
      summary: 'Reviewed passing commit',
    },
    destination: {
      target: 'github_draft_pr',
      branch: 'agent/ollama-verified-slice',
      baseBranch: 'feature/verified-marketplace-core',
    },
    inboxDir,
  });

  assert.equal(reviewedPassing.destination.draftPrEligible, true);
  assert.equal(reviewedPassing.destination.deployEligible, false);
  assert.equal(redactSecrets('Bearer abcdefgh123456'), '[REDACTED]');
});
