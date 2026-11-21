import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
 classifyUkGssCode,
 proposeUkCoverageReconciliation,
} from '../../scripts/geo/propose-uk-coverage-reconciliation.mjs';

const CLI_SCRIPT_PATH=fileURLToPath(
 new URL('../../scripts/geo/propose-uk-coverage-reconciliation.mjs',import.meta.url)
);

const VALID_SHA='a'.repeat(64);

function validProvenance(overrides={}){
 return {
  publisher:'Office for National Statistics (ONS)',
  datasetId:'WD_MAY_2026_UK_BGC',
  version:'2026-05',
  licenseId:'OGL-UK-3.0',
  retrievedAt:'2026-11-21T10:00:00Z',
  sourceUrl:'https://geoportal.statistics.gov.uk/datasets/uk-wards-may-2026',
  sourceSha256:VALID_SHA,
  ...overrides,
 };
}

test('Classifies official GSS codes across England, Scotland, Wales and Northern Ireland',()=>{
 assert.deepEqual(classifyUkGssCode('E05013806'),{code:'E05013806',prefix:'E05',nation:'England',level:'ward'});
 assert.deepEqual(classifyUkGssCode('E09000033'),{code:'E09000033',prefix:'E09',nation:'England',level:'local_authority_district'});
 assert.deepEqual(classifyUkGssCode('S12000036'),{code:'S12000036',prefix:'S12',nation:'Scotland',level:'council_area'});
 assert.deepEqual(classifyUkGssCode('S13002929'),{code:'S13002929',prefix:'S13',nation:'Scotland',level:'ward'});
 assert.deepEqual(classifyUkGssCode('W06000015'),{code:'W06000015',prefix:'W06',nation:'Wales',level:'unitary_authority'});
 assert.deepEqual(classifyUkGssCode('W05001279'),{code:'W05001279',prefix:'W05',nation:'Wales',level:'ward'});
 assert.deepEqual(classifyUkGssCode('N09000003'),{code:'N09000003',prefix:'N09',nation:'Northern Ireland',level:'local_government_district'});
 assert.deepEqual(classifyUkGssCode('N08000301'),{code:'N08000301',prefix:'N08',nation:'Northern Ireland',level:'ward'});
 // Reject Crown Dependencies and malformed strings
 assert.equal(classifyUkGssCode('L93000001'),null);
 assert.equal(classifyUkGssCode('M83000003'),null);
 assert.equal(classifyUkGssCode('INVALID'),null);
});

test('Separates UK-wide searchable proposal from human-reviewed five-slot territory across all four nations',()=>{
 const manifest={
  provenance:validProvenance(),
  regions:[
   {code:'E09000033',name:'Westminster',parentCode:'E12000007'},
   {code:'S12000036',name:'City of Edinburgh'},
   {code:'W06000015',name:'Cardiff'},
   {code:'N09000003',name:'Belfast'},
  ],
 };
 const report=proposeUkCoverageReconciliation(manifest,[]);
 assert.equal(report.status,'PROPOSAL_READY_FOR_HUMAN_REVIEW');
 assert.equal(report.readOnly,true);
 assert.equal(report.approved,false);
 assert.equal(report.autoApprovedCount,0);
 assert.deepEqual(report.summary.nationCounts,{
  England:1,Scotland:1,Wales:1,'Northern Ireland':1,
 });
 assert.equal(report.proposals.length,4);
 for(const item of report.proposals){
  assert.equal(item.searchableScope,'UK_WIDE_SEARCHABLE_ONLY');
  assert.equal(item.territoryReviewStatus,'UNREVIEWED_PROPOSAL_ONLY');
  assert.equal(item.approved,false);
  assert.equal(item.activeProfessionalSlotCap,0);
  assert.equal(item.requiresHumanBoundaryReview,true);
  assert.equal(item.reconciliationAction,'NEW_UNREVIEWED_CANDIDATE');
 }
 assert.ok(report.ownerActionsRequired.some(line=>/five active professionals/i.test(line)));
 assert.ok(report.ownerActionsRequired.some(line=>/legal, compliance and payment sign-off/i.test(line)));
});

test('Fails closed when licence is unverified, host is untrusted or SHA-256 checksum mismatches',()=>{
 const badLicense=proposeUkCoverageReconciliation({
  provenance:validProvenance({licenseId:'Proprietary-All-Rights-Reserved'}),
  regions:[{code:'E09000033',name:'Westminster'}],
 });
 assert.equal(badLicense.status,'PROPOSAL_BLOCKED_FAILED_CHECKS');
 assert.equal(badLicense.proposals.length,0);
 assert.ok(badLicense.provenanceErrors.some(e=>/licence/i.test(e)));

 const badHost=proposeUkCoverageReconciliation({
  provenance:validProvenance({sourceUrl:'https://untrusted.example.com/wards.json'}),
  regions:[{code:'E09000033',name:'Westminster'}],
 });
 assert.equal(badHost.status,'PROPOSAL_BLOCKED_FAILED_CHECKS');
 assert.ok(badHost.provenanceErrors.some(e=>/Untrusted/i.test(e)));

 const badHash=proposeUkCoverageReconciliation(
  {
   provenance:validProvenance({sourceSha256:'b'.repeat(64)}),
   regions:[{code:'E09000033',name:'Westminster'}],
  },
  [],
  {computedSha256:'c'.repeat(64)}
 );
 assert.equal(badHash.status,'PROPOSAL_BLOCKED_FAILED_CHECKS');
 assert.ok(badHash.provenanceErrors.some(e=>/checksum/i.test(e)));
});

test('Detects version drift, name drift, retired codes and conflicting duplicates without auto-approving',()=>{
 const manifest={
  provenance:validProvenance({version:'2026-11'}),
  regions:[
   {code:'E09000033',name:'Westminster'},
   {code:'W06000015',name:'Cardiff / Caerdydd'},
   {code:'S12000036',name:'City of Edinburgh'},
   {code:'N09000003',name:'Belfast'},
  ],
 };
 const reviewedSnapshot=[
  {code:'E09000033',name:'Westminster',reviewedDatasetVersion:'2026-11',reviewed:true},
  {code:'W06000015',name:'Cardiff',reviewedDatasetVersion:'2026-05',reviewed:true},
  {code:'S12000036',name:'City of Edinburgh',reviewedDatasetVersion:'2026-05',reviewed:true},
  {code:'E08000001',name:'Bolton',reviewedDatasetVersion:'2025-05',reviewed:true},
 ];
 const report=proposeUkCoverageReconciliation(manifest,reviewedSnapshot);
 assert.equal(report.status,'PROPOSAL_READY_FOR_HUMAN_REVIEW');
 assert.equal(report.autoApprovedCount,0);
 assert.equal(report.summary.matchingReviewedCount,1);
 assert.equal(report.summary.nameDriftCount,1);
 assert.equal(report.summary.versionDriftCount,1);
 assert.equal(report.summary.newCandidates,1);
 assert.equal(report.summary.retiredFromSourceCount,1);
 assert.equal(report.retiredCodes[0].officialCode,'E08000001');
 assert.equal(report.retiredCodes[0].reconciliationAction,'RETIRED_OR_MISSING_FROM_SOURCE');

 const dupReport=proposeUkCoverageReconciliation({
  provenance:validProvenance(),
  regions:[
   {code:'N09000003',name:'Belfast'},
   {code:'N09000003',name:'Belfast Duplicate'},
  ],
 });
 assert.equal(dupReport.status,'PROPOSAL_BLOCKED_FAILED_CHECKS');
 assert.ok(dupReport.rejectedEntries.some(r=>r.reason==='CONFLICTING_DUPLICATE_CODE'));
});

test('CLI computes actual file SHA-256 and outputs read-only proposal JSON',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trustfive-geo-'));
 try{
  const manifestPath=join(dir,'manifest.json');
  const rawObj={
   provenance:{
    publisher:'Office for National Statistics (ONS)',
    datasetId:'LAD_MAY_2026_UK_BGC',
    version:'2026-05',
    licenseId:'OGL-UK-3.0',
    retrievedAt:'2026-11-21T10:00:00Z',
    sourceUrl:'https://geoportal.statistics.gov.uk/datasets/lad-may-2026',
   },
   regions:[{code:'N09000003',name:'Belfast'}],
  };
  const payload=JSON.stringify(rawObj,null,2);
  writeFileSync(manifestPath,payload,'utf8');
  const expectedSha=createHash('sha256').update(Buffer.from(payload,'utf8')).digest('hex');

  const out=execFileSync(
   process.execPath,
   [CLI_SCRIPT_PATH,manifestPath],
   {encoding:'utf8'}
  );
  const parsed=JSON.parse(out);
  assert.equal(parsed.status,'PROPOSAL_READY_FOR_HUMAN_REVIEW');
  assert.equal(parsed.readOnly,true);
  assert.equal(parsed.approved,false);
  assert.equal(parsed.provenance.sourceSha256,expectedSha);
 }finally{
  rmSync(dir,{recursive:true,force:true});
 }
});
