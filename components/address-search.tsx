'use client';
import {KeyboardEvent,useEffect,useRef,useState} from 'react';

export type SelectedLocation={
 label:string;latitude:number;longitude:number;postcode:string|null;precision:'address'|'postcode';country:string
};
type Props={onSelect:(location:SelectedLocation|null)=>void};
export default function AddressSearch({onSelect}:Props){
 const [query,setQuery]=useState(''),[suggestions,setSuggestions]=useState<SelectedLocation[]>([]);
 const [selected,setSelected]=useState<SelectedLocation|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [retryable,setRetryable]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const [active,setActive]=useState(-1),[dismissed,setDismissed]=useState(false);
 const expanded=!dismissed&&suggestions.length>0;
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  if(selected||query.trim().length<2){setSuggestions([]);return;}
  const abort=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setError('');setRetryable(false);
   try{
    const result=await fetch('/api/address/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:abort.signal,cache:'no-store'});
    const json=await result.json() as {suggestions?:SelectedLocation[];message?:string};
    if(!abort.signal.aborted){
     const matches=result.ok&&Array.isArray(json.suggestions)?json.suggestions:[];
     setSuggestions(matches);
     setRetryable(result.status>=500);
     setError(matches.length?'':json.message||(!result.ok?'Address lookup is temporarily unavailable':''));
    }
   }catch{if(!abort.signal.aborted){setSuggestions([]);setRetryable(true);setError('Address lookup is temporarily unavailable');}}
   finally{if(!abort.signal.aborted)setLoading(false);}
  },500);
  return()=>{clearTimeout(timer);abort.abort();};
 },[query,selected,version]);
 function choose(item:SelectedLocation){setSelected(item);setQuery(item.label);setSuggestions([]);setError('');setActive(-1);inputRef.current?.focus();onSelect(item);}
 function change(value:string){setRetryable(false);setLoading(false);setDismissed(false);setActive(-1);setQuery(value);setSelected(null);setSuggestions([]);onSelect(null);setError('');setVersion(v=>v+1);}
 function find(){setDismissed(false);if(dismissed&&suggestions.length)return;if(suggestions.length===1)choose(suggestions[0]);else if(suggestions.length>1)setError('Choose your exact address from the suggestions below.');else setVersion(v=>v+1);}
 function onInputKeyDown(e:KeyboardEvent<HTMLInputElement>){
  if(e.nativeEvent.isComposing)return;
  if(e.key==='Escape'&&expanded){
   e.preventDefault();setDismissed(true);setActive(-1);setError('');return;
  }
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&suggestions.length){
   e.preventDefault();setDismissed(false);
   setActive(index=>e.key==='ArrowDown'
    ?(index+1)%suggestions.length
    :(index<0?suggestions.length-1:(index+suggestions.length-1)%suggestions.length));
   return;
  }
  if(e.key==='Enter'){
   e.preventDefault();e.stopPropagation();
   if(expanded&&suggestions[active])choose(suggestions[active]);
   else if(!loading&&query.trim().length>=2)find();
  }
 }
 useEffect(()=>{
  if(expanded&&active>=0)document.getElementById(`directory-address-option-${active}`)?.scrollIntoView({block:'nearest'});
 },[expanded,active]);
 return <div className="address-finder">
  <label htmlFor="directory-address">Your postcode or street address</label>
  <div role="search" className="address-finder-form">
   <input id="directory-address" ref={inputRef} role="combobox" aria-autocomplete="list" value={query} onChange={e=>change(e.target.value)} onKeyDown={onInputKeyDown} autoComplete="street-address" placeholder="e.g. BT1, CF10, G1, SW1A 1AA or your street" maxLength={160} aria-describedby="address-privacy" aria-controls={expanded?'address-options':undefined} aria-expanded={expanded} aria-activedescendant={expanded&&active>=0?`directory-address-option-${active}`:undefined}/>
   <button className="btn secondary" type="button" onClick={find} disabled={loading||query.trim().length<2}>{loading?'Finding…':retryable?'Retry address lookup':'Find address'}</button>
  </div>
  {expanded&&<div id="address-options" className="address-suggestions" role="listbox" aria-label="Matching addresses">
    {suggestions.map((item,i)=><button type="button" key={i} role="option" id={`directory-address-option-${i}`} aria-selected={active===i} onClick={()=>choose(item)}>
      <strong>{item.label}</strong><span>{item.precision==='address'?'Street and property address':item.postcode?'Full postcode centre':'Postcode district centre'}</span>
    </button>)}
   </div>}
  {selected&&<div className="address-selection" role="status"><strong>Searching near:</strong> {selected.label}
   <button type="button" onClick={()=>{change('');inputRef.current?.focus();}}>Change</button>
   {selected.precision==='postcode'&&<p>Distance uses an approximate postcode or district centre, not your exact property.</p>}
  </div>}
  {error&&<p className="muted-note" role="status">{error}</p>}
  <p id="address-privacy" className="muted-note">Search across England, Scotland, Wales and Northern Ireland using any UK postcode district or full postcode. Your address is not displayed on public business listings or stored in your directory search. A full postcode or property address is needed to publish a job.</p>
 </div>;
}
