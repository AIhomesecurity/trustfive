'use client';
import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {normaliseTerm,resolveTradeQuery,type TradeChoice} from '../lib/trade-search';

type Props={
  trades:readonly TradeChoice[];
  value:string;
  initialQuery?:string;
  resetSignal?:number;
  catalogReady?:boolean;
  onSelect:(tradeId:string)=>void;
};

/** Accessible service finder. Suggestions come only from live database trade
 * rows; a keyword match is a navigation aid, never an approval claim. */
export default function TradeSearchField({trades,value,initialQuery='',resetSignal=0,catalogReady=true,onSelect}:Props){
  const [query,setQuery]=useState(initialQuery);
  const [open,setOpen]=useState(false);
  const [activeIndex,setActiveIndex]=useState(-1);
  const fieldId=useId();
  const listId=`${fieldId}-list`;
  const helpId=`${fieldId}-help`;
  const inputRef=useRef<HTMLInputElement>(null);
  const result=useMemo(()=>resolveTradeQuery(query,trades),[query,trades]);
  const hasQuery=normaliseTerm(query).length>=2;
  const shouldShowHint=hasQuery&&catalogReady&&result.reason==='unknown'&&!value;

  useEffect(()=>{
    setQuery(initialQuery);setOpen(false);setActiveIndex(-1);
  },[initialQuery,resetSignal]);
  useEffect(()=>{
    if(!value)return;
    const selected=trades.find(trade=>trade.id===value);
    if(selected)setQuery(selected.name);
  },[value,trades]);

  function choose(trade:TradeChoice){
    setQuery(trade.name);setOpen(false);setActiveIndex(-1);onSelect(trade.id);
    inputRef.current?.focus();
  }
  function change(next:string){
    setQuery(next);setOpen(true);setActiveIndex(-1);
    if(value)onSelect('');
  }
  function keydown(event:KeyboardEvent<HTMLInputElement>){
    if(event.key==='Escape'){setOpen(false);setActiveIndex(-1);return;}
    if(event.key==='Tab'){setOpen(false);return;}
    const options=result.matches;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(!open||options.length===0)return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current=>{
        const step=event.key==='ArrowDown'?1:-1;
        return (current+step+options.length)%options.length;
      });
      return;
    }
    if(event.key==='Enter'){
      event.preventDefault();
      if(open&&activeIndex>=0&&options[activeIndex])choose(options[activeIndex].trade);
      else if(result.best)choose(result.best.trade);
      else setOpen(false);
    }
  }

  return <div className="trade-finder">
   <label htmlFor={fieldId}>Search services by name or keyword</label>
   <input
    ref={inputRef}
    id={fieldId}
    type="search"
    value={query}
    placeholder="Try plumber, alarm, CCTV or leak"
    autoComplete="off"
    maxLength={120}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open&&result.matches.length>0}
    aria-controls={listId}
    aria-activedescendant={activeIndex>=0?`${listId}-option-${activeIndex}`:undefined}
    aria-describedby={helpId}
    onChange={event=>change(event.target.value)}
    onFocus={()=>setOpen(true)}
    onKeyDown={keydown}
    onBlur={()=>setTimeout(()=>setOpen(false),120)}
   />
   <p id={helpId} className="muted-note">Search common terms and spelling variations; choose a suggestion from the real service list.</p>
   {open&&hasQuery&&result.matches.length>0&&<ul id={listId} className="trade-finder-options" role="listbox" aria-label="Matching services">
    {result.matches.map((match,index)=><li key={match.trade.id} id={`${listId}-option-${index}`} role="option" aria-selected={activeIndex===index}>
     <button type="button" tabIndex={-1} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(match.trade)}>
      <strong>{match.trade.name}</strong>
      <span>{match.reason==='typo'?'Did you mean this service?':'Matching service'}</span>
     </button>
    </li>)}
   </ul>}
   {shouldShowHint&&<p className="notice" role="status">No exact category for “{query}”. Choose from the available services below, or describe your job and we will match it to a trade.</p>}
  </div>;
}
