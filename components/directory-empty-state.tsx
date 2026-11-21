import Link from 'next/link';

export type DirectoryEmptyContext={
 hasLocation:boolean;
 hasTrade:boolean;
 hasArea:boolean;
};
export function directoryEmptyCopy({hasLocation,hasTrade,hasArea}:DirectoryEmptyContext){
 if(hasLocation)return {
  title:'No approved professionals near this address yet',
  description:'We only show approved professionals with verified service locations covering your selected address. We will not fill gaps with unvetted listings.',
  action:'Try a different location or service'
 };
 if(hasArea&&hasTrade)return {
  title:'No approved professionals for this trade in the selected area yet',
  description:'A trade and area appear in the directory only when eligible professionals have been independently approved. We will not invent a top five.',
  action:'Explore other areas and trades'
 };
 if(hasArea)return {
  title:'No approved professionals listed in this area yet',
  description:'We have not found currently approved professionals matching this area. An empty list is not evidence that nearby businesses are unqualified.',
  action:'Explore other areas'
 };
 if(hasTrade)return {
  title:'No approved professionals for this trade yet',
  description:'There are no currently approved results for this trade in the selected directory view. Check another trade or describe your job.',
  action:'Explore other trades'
 };
 return {
  title:'No approved professionals listed yet',
  description:'TrustFive only displays genuinely approved businesses. No demo listings or paid placements are shown as real providers.',
  action:'Explore all areas and trades'
 };
}

export default function DirectoryEmptyState({context,onReset,jobHref}:{
 context:DirectoryEmptyContext;onReset:()=>void;jobHref:string;
}){
 const copy=directoryEmptyCopy(context);
  return <div className="directory-empty" role="status" aria-labelledby="directory-empty-title">
  <span aria-hidden="true" className="directory-empty-icon">🔎</span>
  <h3 id="directory-empty-title">{copy.title}</h3>
  <p>{copy.description}</p>
  <div className="directory-empty-actions">
   <Link className="btn" href={jobHref}>Post your job</Link>
   <button type="button" className="btn secondary" onClick={onReset}>{copy.action}</button>
   <Link className="btn secondary" href="/coverage">Register interest in your UK area</Link>
  </div>
  <p className="muted-note">Are you a professional? <Link href="/professional/apply">Apply to join the verified network →</Link></p>
 </div>;
}
