'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';

type Trade={id:string;name:string;slug:string};
type Area={id:string;area_name:string;city:string;country_code:string};
type Professional={application_id:string;business_name:string;about:string|null;trade_name:string;area_name:string;city:string;quality_score:number;slot:number;average_stars:number;review_count:number;distance_km?:number|null};
type Sort='nearby'|'quality'|'reviews'|'name';

const aliases:Record<string,string>={
 plumber:'plumbing',plumbers:'plumbing',leak:'plumbing',tap:'plumbing',dripping:'plumbing',
 electrician:'electrical',electricians:'electrical',rewiring:'electrical',wiring:'electrical',
 roofer:'roofing',roofers:'roofing',guttering:'roofing',gutter:'roofing',
 gardener:'gardening',gardeners:'gardening',lawn:'gardening',
 painter:'painting',decorator:'painting',decorating:'painting',
 boiler:'heating',heating:'heating',radiator:'heating',gas:'heating',
 carpenter:'carpentry',joiner:'carpentry',woodwork:'carpentry',
 cleaner:'cleaning',housekeeping:'cleaning',deepclean:'cleaning',
 removals:'moving',removal:'moving',movers:'moving',
 locksmith:'home-security',locks:'home-security',
 landscaper:'landscaping',paving:'landscaping',patio:'landscaping',
 cctv:'cctv-installation',camera:'cctv-installation',cameras:'cctv-installation',
 'security camera':'cctv-installation','security cameras':'cctv-installation',
 'cctv installer':'cctv-installation','cctv installation':'cctv-installation',
 'security camera installation':'cctv-installation','video surveillance':'cctv-installation',
 'home surveillance':'cctv-installation',surveillance:'cctv-installation',
 'ring doorbell':'cctv-installation','video doorbell':'cctv-installation',
 'alarm system':'home-security','burglar alarm':'home-security','intruder alarm':'home-security'
};

function resolveTrade(input:string,trades:Trade[]):Trade|undefined{
 const value=input.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim();
 const query=aliases[value]||value;
 if(!query)return undefined;
 const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim();
 const exact=trades.find(t=>normalized(t.slug)===normalized(query)||normalized(t.name)===normalized(query));
 if(exact)return exact;
 // Prefer a single explicit task synonym before less precise description matching.
 const matchingAlias=Object.entries(aliases).find(([key])=>value===key||value.startsWith(key+' ')||value.endsWith(' '+key));
 const match=matchingAlias?.[1]||query;
 return trades.find(t=>normalized(t.slug)===normalized(match))
  ||trades.find(t=>normalized(t.slug).includes(normalized(match))||normalized(t.name).includes(normalized(match)));
}

export default function Services(){
 const [trades,setTrades]=useState<Trade[]>([]);
 const [areas,setAreas]=useState<Area[]>([]);
 const [trade,setTrade]=useState('');
 const [area,setArea]=useState('');
 const [sort,setSort]=useState<Sort>('quality');
 const [location,setLocation]=useState<SelectedLocation|null>(null);
 const [pros,setPros]=useState<Professional[]>([]);
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [resultsLoading,setResultsLoading]=useState(true);
 const [catalogError,setCatalogError]=useState('');
 const [resultsError,setResultsError]=useState('');
 const [searchHint,setSearchHint]=useState('');

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const s=supabaseBrowser();
    const [t,a]=await Promise.all([
     s.from('trades').select('id,name,slug').order('name'),
     s.from('service_areas').select('id,area_name,city,country_code').order('city')
    ]);
    if(t.error)throw t.error;
    if(a.error)throw a.error;
    if(!active)return;
    const availableTrades=t.data||[],availableAreas=a.data||[];
    setTrades(availableTrades);setAreas(availableAreas);
    const params=new URLSearchParams(window.location.search);
    const requestedTrade=params.get('trade')||params.get('q')||'';
    const selected=resolveTrade(requestedTrade,availableTrades);
    if(selected)setTrade(selected.id);
    else if(requestedTrade)setSearchHint('No exact category for “'+requestedTrade+'”. Choose from the available services.');
    const requestedArea=params.get('area')||'';
    if(availableAreas.some(a=>a.id===requestedArea))setArea(requestedArea);
   }catch(e){
    if(active)setCatalogError(e instanceof Error?e.message:'Services could not be loaded');
   }finally{if(active)setCatalogLoading(false);}
  })();
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  let active=true;
  setResultsLoading(true);setResultsError('');
  (async()=>{
   try{
    const query=location?
     supabaseBrowser().rpc('find_trustfive_professionals_nearby',{p_trade:trade||null,p_lat:location.latitude,p_lon:location.longitude}):
     supabaseBrowser().rpc('find_trustfive_professionals_with_reviews',{p_trade:trade||null,p_area:area||null});
    const {data,error}=await query;
    if(error)throw error;
    if(active)setPros(data||[]);
   }catch(e){
    if(active){setPros([]);setResultsError(e instanceof Error?e.message:'Directory search is temporarily unavailable');}
   }finally{if(active)setResultsLoading(false);}
  })();
  return()=>{active=false};
 },[trade,area,location]);

 const visible=useMemo(()=>{
  const list=[...pros];
  if(sort==='nearby'&&location)list.sort((a,b)=>(a.distance_km??Infinity)-(b.distance_km??Infinity)||b.quality_score-a.quality_score);
  else if(sort==='reviews')list.sort((a,b)=>b.review_count-a.review_count||b.quality_score-a.quality_score);
  else if(sort==='name')list.sort((a,b)=>a.business_name.localeCompare(b.business_name));
  else list.sort((a,b)=>b.quality_score-a.quality_score||b.review_count-a.review_count);
  return list;
 },[pros,sort,location]);
 const tradeEntry=trades.find(t=>t.id===trade);
 const areaEntry=areas.find(a=>a.id===area);
 const jobParams=new URLSearchParams();
 if(tradeEntry)jobParams.set('trade',tradeEntry.slug);
 if(areaEntry)jobParams.set('area',areaEntry.id);
 const jobHref='/jobs'+(jobParams.size?'?'+jobParams.toString():'');
 function clearFilters(){setTrade('');setArea('');setLocation(null);setSearchHint('');setSort('quality');window.history.replaceState(null,'','/services');}
 function updateTrade(value:string){setTrade(value);setSearchHint('');const p=new URLSearchParams(window.location.search);p.delete('q');if(value){const slug=trades.find(t=>t.id===value)?.slug;if(slug)p.set('trade',slug);}else p.delete('trade');window.history.replaceState(null,'','/services'+(p.size?'?'+p.toString():''));}
 function updateArea(value:string){setArea(value);const p=new URLSearchParams(window.location.search);if(value)p.set('area',value);else p.delete('area');window.history.replaceState(null,'','/services'+(p.size?'?'+p.toString():''));}

 return <main className="container directory-page">
  <div className="page-heading"><span className="eyebrow">Find trusted local help</span>
   <h1>Find a TrustFive professional</h1>
   <p className="subtle">Enter your postcode or address to find nearby approved tradespeople. Distances and independently assessed quality help you compare.</p>
  </div>
  <div className="directory-intro">
   <div><strong>Up to five approved professionals</strong><span> per trade, per defined local area — only when they qualify.</span></div>
   <Link href="/jobs" className="btn">Describe your job →</Link>
  </div>
  <div className="directory-layout">
   <aside className="directory-filters" aria-label="Filter professionals">
    <div className="directory-filter-heading"><h2>Find your match</h2><button type="button" className="directory-reset" onClick={clearFilters}>Clear filters</button></div>
    <label htmlFor="directory-trade">Trade or service</label>
    <select id="directory-trade" value={trade} onChange={e=>updateTrade(e.target.value)} disabled={catalogLoading}>
     <option value="">All services</option>{trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
    <AddressSearch onSelect={point=>{setLocation(point);setSort(point?'nearby':'quality');if(point){setArea('');const p=new URLSearchParams(window.location.search);p.delete('area');window.history.replaceState(null,'','/services'+(p.size?'?'+p.toString():''));}}}/>
    <p className="muted-note">Nearby results use verified professional service locations. Distance is approximate straight-line distance, not travel time. Providers without verified locations do not appear in proximity results.</p>
    <div className="directory-filter-guide"><strong>How to choose</strong><p>Review experience, approved quality scores and feedback from completed bookings before agreeing work.</p></div>
   </aside>
   <section className="directory-results" aria-label="Approved professional results">
    {catalogLoading&&<p role="status">Loading service categories…</p>}
    {catalogError&&<p role="alert" className="notice error">Could not load service filters. {catalogError}</p>}
    {searchHint&&<p role="status" className="notice">{searchHint}</p>}
    <div className="directory-results-heading">
     <div><span className="eyebrow">Your local directory</span><h2>{tradeEntry?tradeEntry.name:'All approved professionals'}</h2>
      <p className="subtle">{location?'Near '+location.label:areaEntry?areaEntry.area_name+', '+areaEntry.city:'Enter your address to find the nearest verified professionals'}</p></div>
     <label htmlFor="directory-sort">Sort results
      <select id="directory-sort" value={sort} onChange={e=>setSort(e.target.value as Sort)}>
       {location&&<option value="nearby">Closest first</option>}<option value="quality">Quality score</option><option value="reviews">Most completed-job reviews</option><option value="name">Business name A–Z</option>
      </select>
     </label>
    </div>
    {resultsError&&<p role="alert" className="notice error">Professional search unavailable. {resultsError}</p>}
    {resultsLoading?<p role="status" className="directory-loading">Searching approved professionals…</p>:
     <p className="directory-count" role="status">{visible.length} approved professional{visible.length===1?'':'s'} matching your filters</p>}
    {!resultsLoading&&!resultsError&&visible.length>0&&<div className="directory-result-list">{visible.map(p=>
     <article className="directory-pro" key={p.application_id}>
      <div className="directory-pro-avatar" aria-hidden="true">{p.business_name.trim().charAt(0).toUpperCase()||'T'}</div>
      <div className="directory-pro-body">
       <div className="directory-pro-head"><h3>{p.business_name}</h3><span className="pill">✓ TrustFive approved</span></div>
       <p>{p.trade_name} · {p.area_name}, {p.city}</p>
       <p className="directory-pro-about">{p.about||'Approved local professional'}</p>
       <div className="directory-pro-facts">
        {location&&p.distance_km!=null&&<span><strong>{Number(p.distance_km).toFixed(1)} km</strong> approximate distance</span>}
        <span><strong>{p.quality_score}/100</strong> independent quality score</span>
        <span>{p.review_count>0?<><strong>★ {Number(p.average_stars).toFixed(1)}/5</strong> · {p.review_count} completed-booking review{p.review_count===1?'':'s'}</>:'No completed-booking reviews yet'}</span>
       </div>
       <div className="directory-pro-actions"><Link className="btn secondary" href={'/business/'+p.application_id}>View business profile</Link><Link href={jobHref}>Post a job →</Link></div>
      </div>
     </article>)}</div>}
    {!resultsLoading&&!resultsError&&visible.length===0&&
     <div className="directory-empty"><span aria-hidden="true" className="directory-empty-icon">🔎</span><h3>No approved professionals match your search yet</h3>
      <p>We only show genuinely approved businesses. For nearby searches, professionals must also have a verified service location covering your address.</p>
      <div className="directory-empty-actions"><button type="button" className="btn secondary" onClick={clearFilters}>Explore all areas and trades</button><Link className="btn" href={jobHref}>Post your job</Link></div>
      <p className="muted-note">Are you a professional? <Link href="/professional/apply">Apply to join the verified network →</Link></p>
     </div>}
   </section>
  </div>
 </main>;
}
