#!/usr/bin/env node
/** Read-only sourced UK regional/ward coverage import & reconciliation proposal.
 *
 * Strictly separates "UK-wide searchable" from "human-reviewed five-slot territory".
 * Never writes to the database, never calls external networks, never fabricates
 * boundaries or active professional slots, and never marks any region as reviewed.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const APPROVED_OPEN_LICENSES=new Set([
 'OGL-UK-3.0',
 'Open Government Licence v3.0',
 'OS OpenData Licence',
]);

const TRUSTED_SOURCE_HOSTS=new Set([
 'geoportal.statistics.gov.uk',
 'open-geography-portalx-ons.hub.arcgis.com',
 'osdatahub.os.uk',
 'www.spatialdata.gov.scot',
 'www.opendatani.gov.uk',
 'www.nrscotland.gov.uk',
 'datamap.gov.wales',
]);

/** Official UK GSS prefix catalogue across England, Scotland, Wales & Northern Ireland. */
const GSS_PREFIX_CATALOGUE={
 E05:{nation:'England',level:'ward'},
 E06:{nation:'England',level:'local_authority_district'},
 E07:{nation:'England',level:'local_authority_district'},
 E08:{nation:'England',level:'local_authority_district'},
 E09:{nation:'England',level:'local_authority_district'},
 E12:{nation:'England',level:'region'},
 S12:{nation:'Scotland',level:'council_area'},
 S13:{nation:'Scotland',level:'ward'},
 W05:{nation:'Wales',level:'ward'},
 W06:{nation:'Wales',level:'unitary_authority'},
 N08:{nation:'Northern Ireland',level:'ward'},
 N09:{nation:'Northern Ireland',level:'local_government_district'},
};

const GSS_CODE_PATTERN=/^([ESWN]\d{2})\d{6}$/;
const SHA256_PATTERN=/^[a-f0-9]{64}$/i;
const VERSION_PATTERN=/^[A-Za-z0-9._-]{3,64}$/;
const ISO_DATE_PATTERN=/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/;

const OWNER_ACTIONS_REQUIRED=[
 'Independent human GIS and boundary verification of each official polygon before any territory activation.',
 'Explicit territory sign-off confirming a genuine five-slot operating boundary (searchable UK coverage never auto-opens slots).',
 'Independent real-world vetting of up to five active professionals per trade per approved territory (no paid placement or synthetic listings).',
 'Owner legal, compliance and payment sign-off before enabling any live billing or country release.',
];

function cleanText(value,maxLength=120){
 if(typeof value!=='string')return '';
 return value.trim().replace(/\s+/g,' ').slice(0,maxLength);
}

export function classifyUkGssCode(rawCode){
 const code=cleanText(rawCode,16).toUpperCase();
 const match=GSS_CODE_PATTERN.exec(code);
 if(!match)return null;
 const meta=GSS_PREFIX_CATALOGUE[match[1]];
 if(!meta)return null;
 return {code,prefix:match[1],nation:meta.nation,level:meta.level};
}

function validateProvenance(provenance,computedSha256=null){
 const errors=[];
 if(!provenance||typeof provenance!=='object'){
  return {valid:false,errors:['Missing provenance metadata block'],normalized:null};
 }
 const publisher=cleanText(provenance.publisher,120);
 const datasetId=cleanText(provenance.datasetId,120);
 const version=cleanText(provenance.version,64);
 const licenseId=cleanText(provenance.licenseId,80);
 const retrievedAt=cleanText(provenance.retrievedAt,40);
 const sourceUrl=cleanText(provenance.sourceUrl,240);
 const declaredSha256=cleanText(provenance.sourceSha256||computedSha256||'',64).toLowerCase();

 if(!publisher)errors.push('Missing authoritative publisher name');
 if(!datasetId)errors.push('Missing datasetId identifier');
 if(!VERSION_PATTERN.test(version))errors.push('Missing or malformed dataset version identifier');
 if(!APPROVED_OPEN_LICENSES.has(licenseId)){
  errors.push(`Unverified or non-open licence "${licenseId||'missing'}"; require OGL-UK-3.0 or OS OpenData Licence`);
 }
 if(!ISO_DATE_PATTERN.test(retrievedAt))errors.push('Missing or non-ISO retrievedAt timestamp');
 if(!SHA256_PATTERN.test(declaredSha256)){
  errors.push('Missing valid 64-character SHA-256 checksum for source provenance');
 }else if(computedSha256&&declaredSha256!==computedSha256.toLowerCase()){
  errors.push('Declared sourceSha256 does not match actual manifest file checksum');
 }
 try{
  const parsed=new URL(sourceUrl);
  if(parsed.protocol!=='https:'||!TRUSTED_SOURCE_HOSTS.has(parsed.hostname)){
   errors.push(`Untrusted or non-HTTPS source host "${parsed.hostname||'invalid'}"`);
  }
 }catch{
  errors.push('Missing or invalid HTTPS sourceUrl');
 }

 return {
  valid:errors.length===0,
  errors,
  normalized:{
   publisher,datasetId,version,licenseId,retrievedAt,sourceUrl,
   sourceSha256:declaredSha256||null,
  },
 };
}

/** Build a fail-closed, read-only UK regional/ward coverage reconciliation proposal. */
export function proposeUkCoverageReconciliation(manifest,existingReviewedSnapshot=[],options={}){
 if(!manifest||typeof manifest!=='object'||!Array.isArray(manifest.regions)){
  throw new Error('Expected a UK coverage manifest object with a regions array');
 }
 const provenanceCheck=validateProvenance(manifest.provenance,options.computedSha256||null);
 const reviewedList=Array.isArray(existingReviewedSnapshot)?existingReviewedSnapshot:[];
 const reviewedByCode=new Map();
 for(const item of reviewedList){
  const code=cleanText(item?.code,16).toUpperCase();
  if(code){
   reviewedByCode.set(code,{
    code,
    name:cleanText(item?.name,120),
    reviewedDatasetVersion:cleanText(item?.reviewedDatasetVersion||'',64)||null,
    reviewed:Boolean(item?.reviewed),
   });
  }
 }

 const seenCodes=new Set();
 const proposals=[];
 const rejectedEntries=[];
 const nationCounts={England:0,Scotland:0,Wales:0,'Northern Ireland':0};

 for(let index=0;index<manifest.regions.length;index++){
  const entry=manifest.regions[index];
  const gss=classifyUkGssCode(entry?.code);
  const name=cleanText(entry?.name,120);
  const parentCode=entry?.parentCode?classifyUkGssCode(entry.parentCode)?.code||null:null;

  if(!gss){
   rejectedEntries.push({
    index,
    code:cleanText(entry?.code,32)||null,
    reason:'REJECTED_UNSUPPORTED_OR_NON_UK_GSS_CODE',
   });
   continue;
  }
  if(!name){
   rejectedEntries.push({index,code:gss.code,reason:'REJECTED_MISSING_OFFICIAL_NAME'});
   continue;
  }
  if(seenCodes.has(gss.code)){
   rejectedEntries.push({index,code:gss.code,reason:'CONFLICTING_DUPLICATE_CODE'});
   continue;
  }
  seenCodes.add(gss.code);
  nationCounts[gss.nation]+=1;

  const existing=reviewedByCode.get(gss.code);
  let reconciliationAction='NEW_UNREVIEWED_CANDIDATE';
  if(existing&&existing.reviewed){
   if(existing.name&&existing.name!==name){
    reconciliationAction='NAME_DRIFT_REQUIRES_RE_REVIEW';
   }else if(existing.reviewedDatasetVersion&&provenanceCheck.normalized?.version
     &&existing.reviewedDatasetVersion!==provenanceCheck.normalized.version){
    reconciliationAction='VERSION_DRIFT_REQUIRES_RE_REVIEW';
   }else{
    reconciliationAction='MATCHES_REVIEWED_VERSION';
   }
  }

  proposals.push({
   officialCode:gss.code,
   officialName:name,
   nation:gss.nation,
   geographyLevel:gss.level,
   parentOfficialCode:parentCode,
   reconciliationAction,
   // Strict invariant: searchable UK coverage NEVER implies a human-reviewed
   // five-slot territory or active professional availability.
   searchableScope:'UK_WIDE_SEARCHABLE_ONLY',
   territoryReviewStatus:'UNREVIEWED_PROPOSAL_ONLY',
   approved:false,
   activeProfessionalSlotCap:0,
   requiresHumanBoundaryReview:true,
  });
 }

 const retiredCodes=[];
 for(const [code,existing] of reviewedByCode.entries()){
  if(!seenCodes.has(code)){
   retiredCodes.push({
    officialCode:code,
    previousName:existing.name||null,
    reviewedDatasetVersion:existing.reviewedDatasetVersion,
    reconciliationAction:'RETIRED_OR_MISSING_FROM_SOURCE',
    requiresHumanBoundaryReview:true,
   });
  }
 }

 const blocked=!provenanceCheck.valid||proposals.length===0||rejectedEntries.some(r=>r.reason==='CONFLICTING_DUPLICATE_CODE');

 return {
  status:blocked?'PROPOSAL_BLOCKED_FAILED_CHECKS':'PROPOSAL_READY_FOR_HUMAN_REVIEW',
  readOnly:true,
  approved:false,
  autoApprovedCount:0,
  provenance:provenanceCheck.normalized,
  provenanceErrors:provenanceCheck.errors,
  summary:{
   totalInputRegions:manifest.regions.length,
   acceptedProposalCount:proposals.length,
   rejectedCount:rejectedEntries.length,
   retiredFromSourceCount:retiredCodes.length,
   nationCounts,
   newCandidates:proposals.filter(p=>p.reconciliationAction==='NEW_UNREVIEWED_CANDIDATE').length,
   versionDriftCount:proposals.filter(p=>p.reconciliationAction==='VERSION_DRIFT_REQUIRES_RE_REVIEW').length,
   nameDriftCount:proposals.filter(p=>p.reconciliationAction==='NAME_DRIFT_REQUIRES_RE_REVIEW').length,
   matchingReviewedCount:proposals.filter(p=>p.reconciliationAction==='MATCHES_REVIEWED_VERSION').length,
  },
  proposals:provenanceCheck.valid?proposals:[],
  rejectedEntries,
  retiredCodes,
  ownerActionsRequired:OWNER_ACTIONS_REQUIRED,
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [manifestPath,snapshotPath]=process.argv.slice(2);
 if(!manifestPath){
  process.stderr.write(
   'Usage: node scripts/geo/propose-uk-coverage-reconciliation.mjs <manifest.json> [reviewed-snapshot.json]\n'
  );
  process.exit(2);
 }
 try{
  const manifestBytes=readFileSync(manifestPath);
  const computedSha256=createHash('sha256').update(manifestBytes).digest('hex');
  const manifest=JSON.parse(manifestBytes.toString('utf8'));
  const snapshot=snapshotPath?JSON.parse(readFileSync(snapshotPath,'utf8')):[];
  const report=proposeUkCoverageReconciliation(manifest,snapshot,{computedSha256});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='PROPOSAL_READY_FOR_HUMAN_REVIEW')process.exitCode=3;
 }catch(error){
  process.stderr.write(`UK coverage reconciliation proposal failed: ${error.message}\n`);
  process.exitCode=2;
 }
}
