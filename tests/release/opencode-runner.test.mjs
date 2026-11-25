import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

const REPO_ROOT = resolve(process.cwd());
const RUN_ONE_PATH = join(REPO_ROOT, 'scripts', 'agent', 'run-one.sh');
const PLAYWRIGHT_CONFIG_PATH = join(REPO_ROOT, 'playwright.config.ts');

function findBash() {
  for (const candidate of ['bash', '/bin/bash', '/usr/bin/bash', 'C:\\Program Files\\Git\\bin\\bash.exe']) {
    const probe = spawnSync(candidate, ['--version'], {stdio: 'ignore'});
    if (probe.status === 0) return candidate;
  }
  return null;
}

function occupyPort(port) {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
  });
}

test('playwright.config.ts binds 127.0.0.1 and honours PLAYWRIGHT_PORT override', () => {
  const src = readFileSync(PLAYWRIGHT_CONFIG_PATH, 'utf8');
  assert.match(src, /process\.env\.PLAYWRIGHT_PORT/);
  assert.match(src, /--hostname 127\.0\.0\.1 --port/);
  assert.match(src, /\/api\/health/);
});

test('run-one.sh disables interactive Web Search, avoids port 3112 collisions, strips next-env.d.ts, and reaches workflow validation + draft handoff', async (t) => {
  const bash = findBash();
  if (!bash) {
    t.skip('bash runtime not available on host');
    return;
  }

  const sandbox = mkdtempSync(join(tmpdir(), 'trustfive-opencode-runner-'));
  let blocker = null;

  try {
    // Initialise disposable git repo mimicking feature/verified-marketplace-core checkout.
    execFileSync('git', ['init', '-b', 'agent/trustfive-test'], {cwd: sandbox, stdio: 'ignore'});
    execFileSync('git', ['config', 'user.name', 'Test Bot'], {cwd: sandbox, stdio: 'ignore'});
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {cwd: sandbox, stdio: 'ignore'});

    mkdirSync(join(sandbox, 'scripts', 'agent'), {recursive: true});
    mkdirSync(join(sandbox, 'docs'), {recursive: true});
    mkdirSync(join(sandbox, 'node_modules'), {recursive: true});
    writeFileSync(join(sandbox, 'AGENTS.md'), '# test\n');
    writeFileSync(join(sandbox, 'package.json'), '{"name":"trustfive-test"}\n');
    writeFileSync(join(sandbox, 'scripts', 'agent', 'PROMPT.md'), 'bounded test prompt\n');
    const normalizedRunOne = readFileSync(RUN_ONE_PATH, 'utf8').replace(/\r\n/g, '\n');
    writeFileSync(join(sandbox, 'scripts', 'agent', 'run-one.sh'), normalizedRunOne);
    chmodSync(join(sandbox, 'scripts', 'agent', 'run-one.sh'), 0o755);

    execFileSync('git', ['add', '.'], {cwd: sandbox, stdio: 'ignore'});
    execFileSync('git', ['commit', '-m', 'base'], {cwd: sandbox, stdio: 'ignore'});

    // Occupy port 3112 before running to prove PLAYWRIGHT_PORT moves off the busy port.
    try {
      blocker = await occupyPort(3112);
    } catch {
      blocker = null;
    }

    // Create a fake opencode binary that verifies flags, config permissions, env,
    // writes an allowed file, creates untracked next-env.d.ts, and commits locally.
    const fakeBin = join(sandbox, 'fake-opencode.sh');
    const auditOut = join(sandbox, 'runner-audit.json');
    writeFileSync(
      fakeBin,
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'node -e \'',
        'const fs = require("node:fs");',
        'const cfg = JSON.parse(fs.readFileSync("opencode.json", "utf8"));',
        'fs.writeFileSync(process.env.AUDIT_OUT, JSON.stringify({',
        '  args: process.argv.slice(1),',
        '  permissions: cfg.permissions,',
        '  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,',
        '  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,',
        '  playwrightPort: process.env.PLAYWRIGHT_PORT,',
        '}));',
        '\' "$@"',
        'printf "# Proof deliverable\\n" > docs/agent-proof.md',
        'printf "/// <reference types=\\"next\\" />\\n" > next-env.d.ts',
        'git add docs/agent-proof.md',
        'git commit -m "accidental local agent commit" >/dev/null',
        '',
      ].join('\n'),
      'utf8'
    );
    chmodSync(fakeBin, 0o755);

    const runResult = spawnSync(bash, ['scripts/agent/run-one.sh'], {
      cwd: sandbox,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'synthetic-test-key',
        OPENCODE_SKIP_QUOTA_CHECK: '1',
        OPENCODE_SKIP_NPM_INSTALL: '1',
        OPENCODE_BIN: fakeBin.replace(/\\/g, '/'),
        AUDIT_OUT: auditOut,
        PLAYWRIGHT_PORT: '',
      },
      encoding: 'utf8',
    });

    assert.equal(runResult.status, 0, `run-one.sh failed:\nSTDOUT:\n${runResult.stdout}\nSTDERR:\n${runResult.stderr}`);

    // 1. Verify OpenCode received non-interactive flags & denied Web Search/WebFetch/Question.
    const audit = JSON.parse(readFileSync(auditOut, 'utf8'));
    assert.ok(audit.args.includes('run'), 'expected run subcommand');
    assert.ok(audit.args.includes('--standalone'), 'expected --standalone flag');
    assert.ok(audit.args.includes('--archived'), 'expected --archived flag');
    assert.ok(audit.args.includes('--auto'), 'expected --auto flag');
    assert.ok(audit.args.includes('openrouter/openrouter/free'), 'expected free model pinned');

    const denied = new Set(
      audit.permissions.filter((p) => p.effect === 'deny').map((p) => p.action)
    );
    for (const action of ['websearch', 'webfetch', 'question', 'external_directory']) {
      assert.ok(denied.has(action), `expected ${action} permission to be denied`);
    }

    assert.equal(audit.supabaseUrl, 'http://127.0.0.1:54321');
    assert.match(audit.supabaseKey, /^sb_publishable_/);
    const chosenPort = Number(audit.playwrightPort);
    assert.ok(Number.isInteger(chosenPort) && chosenPort > 0);
    if (blocker) {
      assert.notEqual(chosenPort, 3112, 'expected PLAYWRIGHT_PORT to avoid occupied port 3112');
    }

    // 2. Verify temporary config and generated next-env.d.ts were cleaned up.
    assert.equal(existsSync(join(sandbox, 'opencode.json')), false, 'temporary opencode.json must be removed');
    assert.equal(existsSync(join(sandbox, 'next-env.d.ts')), false, 'untracked next-env.d.ts must be removed');

    // Remove the test harness helper files so only repository files remain for workflow validation.
    rmSync(fakeBin, {force: true});
    rmSync(auditOut, {force: true});

    // 3. Execute the exact Validate changed files logic from trustfive-free-agent.yml
    // and verify changed=true reaches draft PR handoff cleanly.
    const validateScript = [
      'set -euo pipefail',
      'changed=false',
      'while IFS= read -r -d "" file; do',
      '  changed=true',
      '  case "$file" in',
      '    app/*|components/*|lib/*|tests/*|docs/*|public/*)',
      '      echo "Reviewed candidate path: $file" ;;',
      '    *)',
      '      echo "PROTECTED_PATH_VIOLATION: $file" >&2',
      '      exit 1 ;;',
      '  esac',
      'done < <( (git diff --name-only -z; git ls-files --others --exclude-standard -z) | sort -zu )',
      'test "$changed" = "true"',
      'git diff --check',
      'echo "HANDOFF_READY=true"',
    ].join('\n');

    const validateResult = spawnSync(bash, ['-c', validateScript], {
      cwd: sandbox,
      encoding: 'utf8',
    });

    assert.equal(
      validateResult.status,
      0,
      `Workflow validation failed:\nSTDOUT:\n${validateResult.stdout}\nSTDERR:\n${validateResult.stderr}`
    );
    assert.match(validateResult.stdout, /Reviewed candidate path: docs\/agent-proof\.md/);
    assert.match(validateResult.stdout, /HANDOFF_READY=true/);
  } finally {
    if (blocker) {
      await new Promise((r) => blocker.close(r));
    }
    rmSync(sandbox, {recursive: true, force: true});
  }
});
