import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const script = fileURLToPath(new URL('../../scripts/release/rehearsal-evidence.mjs', import.meta.url));
const sha = 'a'.repeat(40);
const ids = [
  'preview-private', 'preview-authorized', 'job-quote-booking', 'appointment',
  'consent-revocation', 'unrelated-address-denied', 'completion-review',
  'moderation-isolation', 'five-cap', 'waiting-list', 'ranking',
];

function run(report, expectedSha = sha) {
  return runRaw(JSON.stringify(report), expectedSha);
}

function runRaw(source, expectedSha = sha) {
  const directory = mkdtempSync(join(tmpdir(), 'trustfive-evidence-'));
  try {
    const path = join(directory, 'report.json');
    writeFileSync(path, source);
    return spawnSync(process.execPath, [script, path, expectedSha], {encoding: 'utf8'});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

test('accepts a complete passing report for the expected commit', () => {
  const result = run({sha, evidence: Object.fromEntries(ids.map(id => [id, 'passed']))});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\| ranking \| passed \|/);
});

test('blocks absent, failed and blocked checks', () => {
  const result = run({sha, evidence: {'preview-private': 'failed', appointment: 'blocked'}});
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\| ranking \| missing \|/);
  assert.match(result.stdout, /\| preview-private \| failed \|/);
  assert.match(result.stdout, /\| appointment \| blocked \|/);
});

test('rejects the wrong commit or unexpected fields without copying data to output', () => {
  assert.equal(run({sha, evidence: {}}, 'b'.repeat(40)).status, 1);
  for (const report of [
    {sha, evidence: {}, extra: 'fictional private details'},
    {sha, evidence: {appointment: 'fictional private details'}},
    {sha, evidence: {'fictional private details': 'passed'}},
    {sha, evidence: []},
    {sha, evidence: null},
  ]) {
    const result = run(report);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /fictional private details/);
  }
});

test('rejects truncated release evidence without echoing its contents', () => {
  const result = runRaw('{"sha":"' + sha + '","evidence":{"ranking":"fictional private details"');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error parsing JSON/);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /fictional private details/);
});
