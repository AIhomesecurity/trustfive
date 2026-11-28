import {readFileSync} from 'node:fs';

const knownIds = [
  'preview-private',
  'preview-authorized',
  'job-quote-booking',
  'appointment',
  'consent-revocation',
  'unrelated-address-denied',
  'completion-review',
  'moderation-isolation',
  'five-cap',
  'waiting-list',
  'ranking'
];

const knownStatuses = ['passed', 'failed', 'blocked'];

function validateSha(sha) {
  return /^[0-9a-fA-F]{40}$/.test(sha);
}

function validateEvidence(evidence) {
  for (const id in evidence) {
    if (!knownIds.includes(id)) {
      return false;
    }
    if (!knownStatuses.includes(evidence[id])) {
      return false;
    }
  }
  return true;
}

function renderTable(evidence) {
  let table = '| ID | Status |\n';
  table += '| --- | --- |\n';
  for (const id of knownIds) {
    const status = evidence[id] || 'missing';
    table += `| ${id} | ${status} |\n`;
  }
  return table;
}

function main() {
  if (process.argv.length !== 4) {
    console.error('Usage: node scripts/release/rehearsal-evidence.mjs <report.json> <expected-sha>');
    process.exitCode = 1;
    return;
  }

  const path = process.argv[2];
  const expectedSha = process.argv[3];

  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!data || Object.keys(data).length !== 2 || !validateSha(expectedSha) || data.sha !== expectedSha) {
      console.error('Invalid or mismatched SHA');
      process.exitCode = 1;
      return;
    }
    if (!data.evidence || typeof data.evidence !== 'object' || Array.isArray(data.evidence) || !validateEvidence(data.evidence)) {
      console.error('Invalid evidence');
      process.exitCode = 1;
      return;
    }
    const table = renderTable(data.evidence);
    console.log(table);
    if (knownIds.some(id => data.evidence[id] !== 'passed')) {
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error('Error parsing JSON or rendering table');
    process.exitCode = 1;
    return;
  }
}

main();
