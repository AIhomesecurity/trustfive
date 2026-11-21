import {test,expect} from '@playwright/test';
import {releaseEvidenceMatrix,releaseGateLabels} from '../../lib/release-evidence-matrix';

const allMissing=Object.keys(releaseGateLabels);
const blocked={
 reviewedTerritories:0,verifiedProfessionalsWithServiceLocations:0,
 humanApprovals:0,missingApprovals:allMissing,
 eligibleForHumanReleaseReview:false,productionAutomaticallyEnabled:false
};

test('A healthy app build cannot turn zero vetted professionals or zero verified boundaries into launch approval',()=>{
 const result=releaseEvidenceMatrix(blocked);
 expect(result.rows).toHaveLength(8);
 expect(result.rows.every(row=>!row.verified)).toBe(true);
 expect(result.readyForSeparateOwnerReview).toBe(false);
});

test('Recorded human signoffs do not bypass missing genuine territory or vetted professional coverage',()=>{
 const result=releaseEvidenceMatrix({...blocked,humanApprovals:6,missingApprovals:[],
  eligibleForHumanReleaseReview:true});
 expect(result.rows.filter(row=>row.verified)).toHaveLength(6);
 expect(result.rows.find(row=>row.id==='territories')?.verified).toBe(false);
 expect(result.rows.find(row=>row.id==='professional-locations')?.verified).toBe(false);
 expect(result.readyForSeparateOwnerReview).toBe(false);
});

test('Malformed, contradictory or duplicated signoff evidence always fails closed',()=>{
 for(const invalid of [
  {...blocked,humanApprovals:6},
  {...blocked,humanApprovals:6,missingApprovals:['privacy','privacy']},
  {...blocked,humanApprovals:5,missingApprovals:[]},
  {...blocked,humanApprovals:6,missingApprovals:['unknown-gate']},
  {...blocked,humanApprovals:6,missingApprovals:'not-an-array'}
 ]){
  const result=releaseEvidenceMatrix(invalid);
  expect(result.rows.slice(2).every(row=>!row.verified)).toBe(true);
  expect(result.readyForSeparateOwnerReview).toBe(false);
 }
});

test('All evidence may qualify for a separate human review but never auto-enables production',()=>{
 const complete={...blocked,
  reviewedTerritories:4,verifiedProfessionalsWithServiceLocations:12,
  humanApprovals:6,missingApprovals:[],eligibleForHumanReleaseReview:true
 };
 const result=releaseEvidenceMatrix(complete);
 expect(result.rows.every(row=>row.verified)).toBe(true);
 expect(result.readyForSeparateOwnerReview).toBe(true);
 expect(releaseEvidenceMatrix({...complete,productionAutomaticallyEnabled:true}).readyForSeparateOwnerReview)
  .toBe(false);
 expect(releaseEvidenceMatrix({...complete,eligibleForHumanReleaseReview:false}).readyForSeparateOwnerReview)
  .toBe(false);
});
