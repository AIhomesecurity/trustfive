import {releaseEvidenceMatrix,type ReleaseEvidenceInput} from '../lib/release-evidence-matrix';

/** Read-only presentation. Human sign-offs must be recorded independently. */
export default function ReleaseEvidenceMatrix({status}:{status:ReleaseEvidenceInput}){
 const result=releaseEvidenceMatrix(status);
 return <section aria-labelledby="release-checklist-title">
  <h3 id="release-checklist-title">Evidence-based release checklist</h3>
  <p className="muted-note">Eight requirements are checked from current restricted database evidence. A reviewed country still needs a separate owner production decision.</p>
  <ul className="list" aria-label="Country release evidence requirements">
   {result.rows.map(item=><li key={item.id} style={{padding:'10px 0',borderBottom:'1px solid #d9e9dd'}}>
    <strong>{item.verified?'Verified':'Blocked'} — {item.label}</strong>
    {!item.verified&&<p className="muted-note">{item.explanation}</p>}
   </li>)}
  </ul>
  <p role="status" className="notice">
   {result.readyForSeparateOwnerReview?
    'All eight evidence requirements are recorded. A separate owner decision is still required before any production change.':
    'Launch remains blocked until all required independent reviews, verified territory coverage and vetted professional evidence exist.'}
  </p>
  <p className="muted-note">This checklist cannot enable live Stripe payments or deploy the production site.</p>
 </section>;
}
