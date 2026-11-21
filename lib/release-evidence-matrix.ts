/** A read-only, fail-closed presentation of the private country release RPC.
 * It cannot grant legal, payment, territory or professional approvals. */
export const releaseGateLabels={
 legal_terms:'Independent legal terms review',
 privacy:'Data protection review',
 payments:'Payment provider and live-money approval',
 security:'Production security review',
 operational_support:'Customer support and incidents',
 authenticated_acceptance:'Signed-in real participant acceptance'
} as const;
export type ReleaseGate=keyof typeof releaseGateLabels;
const gates=Object.keys(releaseGateLabels) as ReleaseGate[];
export type ReleaseEvidenceInput={
 reviewedTerritories:unknown;
 verifiedProfessionalsWithServiceLocations:unknown;
 humanApprovals:unknown;
 missingApprovals:unknown;
 eligibleForHumanReleaseReview:unknown;
 productionAutomaticallyEnabled:unknown;
};
export type EvidenceRow={id:string;label:string;verified:boolean;explanation:string};

const positiveInteger=(value:unknown)=>typeof value==='number'&&
 Number.isSafeInteger(value)&&value>0;
export function releaseEvidenceMatrix(data:ReleaseEvidenceInput):{
 rows:EvidenceRow[];
 readyForSeparateOwnerReview:boolean;
} {
 const missing=Array.isArray(data.missingApprovals)?data.missingApprovals:null;
 const validMissing=missing!==null&&
  missing.every(item=>typeof item==='string'&&gates.includes(item as ReleaseGate))&&
  new Set(missing).size===missing.length;
 const signoffCount=typeof data.humanApprovals==='number'&&
  Number.isSafeInteger(data.humanApprovals)?data.humanApprovals:-1;
 const consistentSignoffs=validMissing&&signoffCount===gates.length-missing.length;
 const rows:EvidenceRow[]=[
  {id:'territories',label:'Independently reviewed territory boundaries',
   verified:positiveInteger(data.reviewedTerritories),
   explanation:'A configured city or postcode alone is not a verified operating territory.'},
  {id:'professional-locations',label:'Active vetted professionals with reviewed service locations',
   verified:positiveInteger(data.verifiedProfessionalsWithServiceLocations),
   explanation:'Pending applicants and unverified service coordinates are not approved listings.'},
  ...gates.map(gate=>({
   id:gate,label:releaseGateLabels[gate],
   verified:Boolean(consistentSignoffs&&!missing!.includes(gate)),
   explanation:'An authorised independent human review must be recorded; a green build is not a sign-off.'
  }))
 ];
 const ready=rows.every(r=>r.verified)&&data.eligibleForHumanReleaseReview===true&&
  data.productionAutomaticallyEnabled===false;
 return {rows,readyForSeparateOwnerReview:ready};
}
