'use client';
import {KeyboardEvent,useEffect,useId,useState} from 'react';

export type SelectedLocation={
 label:string;latitude:number;longitude:number;postcode:string|null;precision:'address'|'postcode';country:string
};
type Props={onSelect:(location:SelectedLocation|null)=>void};
export default function AddressSearch({onSelect}:Props){
 const [query,setQuery]=useState(''),[suggestions,setSuggestions]=useState<SelectedLocation[]>([]);
 const [selected,setSelected]=useState<SelectedLocation|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [active,setActive]=useState(-1);
 const [version,setVersion]=useState(0);
 const listId=useId();
 const optionId=(index:number)=>`${listId}-option-${index}`;
 useEffect(()=>{
  if(selected||query.trim().length<2){setSuggestions([]);setActive(-1);return;}
  const abort=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    const result=await fetch('/api/address/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:abort.signal,cache:'no-store'});
    const json=await result.json() as {suggestions?:SelectedLocation[];message?:string};
    if(!abort.signal.aborted){setSuggestions(json.suggestions||[]);setActive(-1);setError(json.message&&(!json.suggestions?.length)?json.message:'');}
   }catch{if(!abort.signal.aborted){setSuggestions([]);setActive(-1);setError('Address lookup is temporarily unavailable');}}
   finally{if(!abort.signal.aborted)setLoading(false);}
  },500);
  return()=>{clearTimeout(timer);abort.abort();};
 },[query,selected,version]);
 function choose(item:SelectedLocation){setSelected(item);setQuery(item.label);setSuggestions([]);setActive(-1);setError('');onSelect(item);}
 function change(value:string){setQuery(value);setSelected(null);setSuggestions([]);setActive(-1);onSelect(null);setError('');setVersion(v=>v+1);}
 function find(){if(suggestions.length===1)choose(suggestions[0]);else if(suggestions.length>1)setError('Choose your exact address from the suggestions below.');else setVersion(v=>v+1);}
 function onInputKeyDown(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==='ArrowDown'&&suggestions.length){e.preventDefault();setActive(i=>(i+1)%suggestions.length);return;}
  if(e.key==='ArrowUp'&&suggestions.length){e.preventDefault();setActive(i=>(i<=0?suggestions.length:i)-1);return;}
  if(e.key==='Enter'){
   e.preventDefault();e.stopPropagation();
   if(active>=0&&suggestions[active])choose(suggestions[active]);
   else if(!loading&&query.trim().length>=2)find();
   return;
  }
  if(e.key==='Escape'||e.key==='Tab'){setSuggestions([]);setActive(-1);}
 }
 return <div className="address-finder">
  <label htmlFor={`${listId}-input`}>Your postcode or street address</label>
  <div role="search" className="address-finder-form">
   <input id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" value={query} onChange={e=>change(e.target.value)} onKeyDown={onInputKeyDown} autoComplete="street-address" placeholder="e.g. BT1, CF10, G1, SW1A 1AA or your street" maxLength={160} aria-describedby="address-privacy" aria-controls={listId} aria-expanded={suggestions.length>0} aria-activedescendant={active>=0?optionId(active):undefined}/>
   <button className="btn secondary" type="button" onClick={find} disabled={loading||query.trim().length<2}>{loading?'Finding…':'Find address'}</button>
  </div>
  {suggestions.length>0&&<div id={listId} className="address-suggestions" role="listbox" aria-label="Matching addresses">
    {suggestions.map((item,i)=><button type="button" key={i} id={optionId(i)} role="option" aria-selected={active===i} onMouseEnter={()=>setActive(i)} onClick={()=>choose(item)}>
      <strong>{item.label}</strong><span>{item.precision==='address'?'Street and property address':item.postcode?'Full postcode centre':'Postcode district centre'}</span>
    </button>)}
   </div>}
  {selected&&<div className="address-selection" role="status"><strong>Searching near:</strong> {selected.label}
   <button type="button" onClick={()=>change('')}>Change</button>
   {selected.precision==='postcode'&&<p>Distance uses an approximate postcode or district centre, not your exact property.</p>}
  </div>}
  {error&&<p className="muted-note" role="status">{error}</p>}
  <p id="address-privacy" className="muted-note">Search across England, Scotland, Wales and Northern Ireland using any UK postcode district or full postcode. Your address is not displayed on public business listings or stored in your directory search. A full postcode or property address is needed to publish a job.</p>
 </div>;
}
