'use client';
import {useRef,type KeyboardEvent} from 'react';

export type TradeChoice={id:string;name:string;slug:string};
const priority=['cctv-installation','home-security','plumbing','electrical','roofing','cleaning'];

export function popularTradeChoices(trades:readonly TradeChoice[],max=6):TradeChoice[]{
 const bySlug=new Map(trades.map(t=>[t.slug,t]));
 return priority.map(slug=>bySlug.get(slug)).filter((t):t is TradeChoice=>Boolean(t)).slice(0,max);
}

/** An optional quick selector drawn only from real database trade rows.
 * The full native select remains available for all categories. */
export default function TradeQuickPick({
 trades,value,onChange
}:{trades:readonly TradeChoice[];value:string;onChange:(value:string)=>void}){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 const options=popularTradeChoices(trades);
 if(options.length<2)return null;
 function keydown(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const keys:Record<string,number>={
   ArrowRight:index+1,ArrowDown:index+1,ArrowLeft:index-1,ArrowUp:index-1,
   Home:0,End:options.length-1
  };
  const next=keys[event.key];
  if(next===undefined)return;
  event.preventDefault();
  const pos=(next+options.length)%options.length;
  onChange(options[pos].id);
  refs.current[pos]?.focus();
 }
 const current=options.findIndex(t=>t.id===value);
 return <fieldset className="trade-quick-fieldset">
  <legend>Popular services — quick choice</legend>
  <div className="trade-quick-grid" role="radiogroup" aria-label="Choose a popular trade">
   {options.map((t,i)=><button
    key={t.id} type="button" ref={el=>{refs.current[i]=el}}
    role="radio" aria-checked={t.id===value}
    tabIndex={t.id===value||current<0&&i===0?0:-1}
    className="trade-quick-tile"
    onKeyDown={e=>keydown(e,i)} onClick={()=>onChange(t.id)}
   ><span aria-hidden="true" className="trade-quick-mark">{t.id===value?'✓':'+'}</span>{t.name}</button>)}
  </div>
  <p className="muted-note">Or choose any other service from the complete trade list below.</p>
 </fieldset>;
}
