import Link from 'next/link';
import type {DirectoryStateCopy} from '../lib/directory-view-state';

/** Shared presentation for the loading and failure states of the directory. */
export default function DirectoryStatePanel({tone,copy,jobHref,onRetry}:{
 tone:'loading'|'error';copy:DirectoryStateCopy;jobHref:string;onRetry?:()=>void;
}){
 const isError=tone==='error';
 return <div className="directory-state-panel" data-tone={tone} role={isError?'alert':'status'} aria-busy={!isError}>
  <span aria-hidden="true" className="directory-state-icon">{isError?'⚠️':'🔎'}</span>
  <h3>{copy.title}</h3>
  <p>{copy.description}</p>
  <div className="directory-state-actions">
   {isError&&onRetry&&<button type="button" className="btn secondary" onClick={onRetry}>Try again</button>}
   <Link className="btn" href={jobHref}>Post your job</Link>
  </div>
 </div>;
}
