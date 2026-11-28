import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const DEFAULT_COORDINATOR_INBOX_DIR = 'C:\\Users\\Gary\\trustfive-agent-control';
export const ALLOWED_OLLAMA_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const PROTECTED_BRANCHES = new Set(['main', 'master', 'development/foundation']);
const ALLOWED_AGENT_BRANCH_RE = /^agent\/[a-z0-9][a-z0-9._/-]{2,90}$/i;

const SECRET_PATTERNS = [
  /\bsk_(?:live|test)_[A-Za-z0-9]{8,}\b/g,
  /\bwhsec_[A-Za-z0-9]{8,}\b/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,
  /(CF-Access-Client-Secret\s*[:=]\s*)([^\s"',}]+)/gi,
];

export function redactSecrets(input) {
  if (typeof input !== 'string') return '';
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (...args) => {
      if (args.length >= 4 && typeof args[1] === 'string' && args[1].toLowerCase().includes('cf-access')) {
        return `${args[1]}[REDACTED]`;
      }
      return '[REDACTED]';
    });
  }
  return out;
}

export function assertLocalOllamaEndpoint(endpointUrl) {
  let parsed;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new Error('Ollama endpoint must be a valid local loopback URL.');
  }
  if (parsed.protocol !== 'http:' || !ALLOWED_OLLAMA_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Refusing non-local Ollama endpoint "${parsed.hostname}". Paid or remote inference fallback is forbidden.`
    );
  }
  return parsed.toString().replace(/\/$/, '');
}

export function canOpenGithubDraftPr(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.reviewState !== 'reviewed_passing') return false;
  if (record.status !== 'commit_recorded') return false;
  if (!FULL_SHA_RE.test(record.originatingSha ?? '')) return false;
  if (!FULL_SHA_RE.test(record.artifact?.commitSha ?? '')) return false;
  if (record.testEvidence?.passed !== true) return false;
  if (!Array.isArray(record.testEvidence?.commands) || record.testEvidence.commands.length === 0) {
    return false;
  }
  const dest = record.destination ?? {};
  if (dest.target !== 'github_draft_pr') return false;
  if (typeof dest.branch !== 'string' || !ALLOWED_AGENT_BRANCH_RE.test(dest.branch)) return false;
  if (typeof dest.baseBranch !== 'string' || !dest.baseBranch.trim() || PROTECTED_BRANCHES.has(dest.baseBranch.trim())) {
    return false;
  }
  return true;
}

export function buildHandoffRecord(input) {
  const originatingSha = typeof input.originatingSha === 'string' ? input.originatingSha.trim() : '';
  if (!FULL_SHA_RE.test(originatingSha)) {
    throw new Error('Every Ollama handoff record must include a full 40-character originating Git SHA.');
  }
  const attemptId =
    typeof input.attemptId === 'string' && /^[a-z0-9._-]{3,80}$/i.test(input.attemptId.trim())
      ? input.attemptId.trim()
      : `ollama-${Date.now()}`;
  const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : 'qwen2.5-coder:7b';
  const validStatuses = new Set(['patch_recorded', 'commit_recorded', 'tests_failed', 'failed', 'rejected']);
  const status = validStatuses.has(input.status) ? input.status : 'failed';
  const reviewState = input.reviewState === 'reviewed_passing' ? 'reviewed_passing' : 'unreviewed_model_output';

  const testCommands = Array.isArray(input.testEvidence?.commands)
    ? input.testEvidence.commands.map(c => redactSecrets(String(c))).filter(Boolean)
    : [];
  const testPassed = Boolean(input.testEvidence?.passed) && testCommands.length > 0;
  const testSummary = redactSecrets(String(input.testEvidence?.summary ?? 'No tests executed'));

  const artifactKind =
    input.artifact?.kind === 'commit' || input.artifact?.kind === 'patch' ? input.artifact.kind : 'none';
  const artifact = {
    kind: artifactKind,
    ...(artifactKind === 'patch' && input.artifact?.patchPath ? {patchPath: String(input.artifact.patchPath)} : {}),
    ...(artifactKind === 'commit' && FULL_SHA_RE.test(input.artifact?.commitSha ?? '')
      ? {commitSha: input.artifact.commitSha}
      : {}),
  };

  const destinationBase = {
    target: input.destination?.target || 'coordinator_inbox',
    ...(input.destination?.branch ? {branch: String(input.destination.branch)} : {}),
    ...(input.destination?.baseBranch ? {baseBranch: String(input.destination.baseBranch)} : {}),
    ...(input.destination?.worker ? {worker: String(input.destination.worker)} : {}),
    ...(input.destination?.hostname ? {hostname: String(input.destination.hostname)} : {}),
    // Raw model output is NEVER eligible for direct Cloudflare deployment.
    deployEligible: false,
  };

  const draftCandidate = {
    at: input.at || new Date().toISOString(),
    event: 'ollama_handoff',
    attemptId,
    model,
    originatingSha,
    status,
    reviewState,
    artifact,
    testEvidence: {
      commands: testCommands,
      passed: testPassed,
      summary: testSummary,
    },
    destination: {
      ...destinationBase,
      draftPrEligible: false,
    },
    ...(input.error ? {error: redactSecrets(String(input.error))} : {}),
  };

  draftCandidate.destination.draftPrEligible = canOpenGithubDraftPr(draftCandidate);
  return draftCandidate;
}

export async function recordOllamaHandoffToInbox(options) {
  const inboxDir = resolve(options.inboxDir || process.env.TRUSTFIVE_COORDINATOR_INBOX || DEFAULT_COORDINATOR_INBOX_DIR);
  const reportsDir = join(inboxDir, 'reports');
  const patchesDir = join(inboxDir, 'patches');
  await mkdir(reportsDir, {recursive: true});

  let artifact = options.artifact ?? {kind: 'none'};
  if (typeof options.patchContent === 'string' && options.patchContent.trim().length > 0) {
    await mkdir(patchesDir, {recursive: true});
    const safeId = (options.attemptId || `ollama-${Date.now()}`).replace(/[^a-z0-9._-]/gi, '-');
    const patchPath = join(patchesDir, `${safeId}.patch`);
    await writeFile(patchPath, redactSecrets(options.patchContent), 'utf8');
    artifact = {kind: 'patch', patchPath};
  }

  const record = buildHandoffRecord({
    ...options,
    artifact,
  });

  const eventsPath = join(inboxDir, 'events.jsonl');
  await appendFile(eventsPath, JSON.stringify(record) + '\n', 'utf8');

  const jsonReportPath = join(reportsDir, `${record.attemptId}.handoff.json`);
  await writeFile(jsonReportPath, JSON.stringify(record, null, 2) + '\n', 'utf8');

  const mdReportPath = join(reportsDir, `${record.attemptId}.handoff.md`);
  const markdown = [
    `# Ollama Handoff Record — ${record.attemptId}`,
    '',
    `- **Recorded at:** ${record.at}`,
    `- **Model:** ${record.model}`,
    `- **Originating SHA:** \`${record.originatingSha}\``,
    `- **Status:** \`${record.status}\``,
    `- **Review State:** \`${record.reviewState}\``,
    `- **Artifact:** ${record.artifact.kind}${record.artifact.commitSha ? ` (\`${record.artifact.commitSha}\`)` : ''}${record.artifact.patchPath ? ` (\`${record.artifact.patchPath}\`)` : ''}`,
    `- **Test Evidence:** ${record.testEvidence.passed ? 'PASSED' : 'NOT PASSED'} — ${record.testEvidence.summary}`,
    `- **Test Commands:** ${record.testEvidence.commands.length ? record.testEvidence.commands.map(c => `\`${c}\``).join(', ') : 'None'}`,
    `- **Destination:** ${record.destination.target}${record.destination.branch ? ` (branch \`${record.destination.branch}\` -> \`${record.destination.baseBranch ?? 'unspecified'}\`)` : ''}`,
    `- **GitHub Draft PR Eligible:** ${record.destination.draftPrEligible ? 'Yes (reviewed passing commit)' : 'No (requires independent review and passing tests)'}`,
    `- **Direct Deploy Eligible:** No (raw model output deployments are forbidden; use scripts/release/deploy-preview-gate.mjs)`,
    ...(record.error ? [`- **Error:** ${record.error}`] : []),
    '',
  ].join('\n');
  await writeFile(mdReportPath, markdown, 'utf8');

  return {record, eventsPath, jsonReportPath, mdReportPath};
}

export async function runGuardedOllamaAttempt({
  attemptId,
  endpoint = 'http://127.0.0.1:11434',
  model = 'qwen2.5-coder:7b',
  originatingSha,
  destination,
  inboxDir,
  executeAttempt,
  runTests,
}) {
  let localEndpoint;
  try {
    localEndpoint = assertLocalOllamaEndpoint(endpoint);
  } catch (error) {
    return recordOllamaHandoffToInbox({
      attemptId,
      model,
      originatingSha,
      status: 'rejected',
      reviewState: 'unreviewed_model_output',
      artifact: {kind: 'none'},
      testEvidence: {commands: [], passed: false, summary: 'Endpoint rejected before inference'},
      destination: destination || {target: 'coordinator_inbox'},
      inboxDir,
      error: error instanceof Error ? error.message : 'Invalid Ollama endpoint',
    });
  }

  try {
    const attemptResult = await executeAttempt({endpoint: localEndpoint, model, originatingSha});
    const testResult = typeof runTests === 'function'
      ? await runTests(attemptResult)
      : {commands: [], passed: false, summary: 'No automated tests executed for raw model output'};

    const hasPatch = typeof attemptResult?.patchContent === 'string' && attemptResult.patchContent.trim().length > 0;
    const hasCommit = FULL_SHA_RE.test(attemptResult?.commitSha ?? '');
    let status = 'failed';
    if (testResult.passed && hasCommit) status = 'commit_recorded';
    else if (testResult.passed && hasPatch) status = 'patch_recorded';
    else if (!testResult.passed && (hasPatch || hasCommit)) status = 'tests_failed';
    else if (hasPatch) status = 'patch_recorded';

    return recordOllamaHandoffToInbox({
      attemptId,
      model,
      originatingSha,
      status,
      // Local Ollama attempts always start as unreviewed_model_output; human/lead review promotes separately.
      reviewState: 'unreviewed_model_output',
      patchContent: hasPatch ? attemptResult.patchContent : undefined,
      artifact: hasCommit ? {kind: 'commit', commitSha: attemptResult.commitSha} : {kind: 'none'},
      testEvidence: testResult,
      destination: destination || {target: 'coordinator_inbox'},
      inboxDir,
      error: attemptResult?.error,
    });
  } catch (error) {
    return recordOllamaHandoffToInbox({
      attemptId,
      model,
      originatingSha,
      status: 'failed',
      reviewState: 'unreviewed_model_output',
      artifact: {kind: 'none'},
      testEvidence: {commands: [], passed: false, summary: 'Ollama attempt failed before test completion'},
      destination: destination || {target: 'coordinator_inbox'},
      inboxDir,
      error: error instanceof Error ? error.message : 'Ollama attempt failed',
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(
    JSON.stringify({
      tool: 'trustfive-ollama-handoff',
      defaultInbox: DEFAULT_COORDINATOR_INBOX_DIR,
      allowedOllamaHosts: [...ALLOWED_OLLAMA_HOSTS],
      rawModelDeployAllowed: false,
      draftPrRequiresReviewedPassingCode: true,
    })
  );
}
