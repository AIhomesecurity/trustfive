'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
import FairSelectionNotice from '../../components/fair-selection-notice';
import DirectoryEmptyState from '../../components/directory-empty-state';

type Trade={id:string;name:string;slug:string};
type Area={id:string;area_name:string;city:string;country_code:string};
type Professional={application_id:string;business_name:string;about:string|null;trade_name:string;area_name:string;city:string;quality_score:number;slot:number;average_stars:number;review_count:number;distance_km?:number|null};
type Sort='recommended'|'nearby'|'quality'|'reviews'|'name';

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
 'ring doorbell':'cctv-installation','video doorbell':'cctv-installation','doorbell camera':'cctv-installation','ip camera':'cctv-installation','ip cameras':'cctv-installation',
 'alarm system':'home-security','alarm installation':'home-security','alarms':'home-security','burglar alarm':'home-security','burglar alarms':'home-security','intruder alarm':'home-security','security alarm':'home-security'
};

function resolveTrade(input:string,trades:Trade[]):Trade|undefined{
 const value=input.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const query=aliases[value]||value;
 if(!query)return undefined;
 const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
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
 const [addressVersion,setAddressVersion]=useState(0);
 const [pros,setPros]=useState<Professional[]>([]);
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [resultsLoading,setResultsLoading]=useState(true);
 const [retryVersion,setRetryVersion]=useState(0);
 const [catalogError,setCatalogError]=useState('');
 const [resultsError,setResultsError]=useState('');
 const [searchHint,setSearchHint]=useState('');
 const [shortlistIds,setShortlistIds]=useState<string[]>([]);
 const [shortlistReady,setShortlistReady]=useState(false);
 const [shortlistNotice,setShortlistNotice]=useState('');

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
 },[trade,area,location,retryVersion]);

 useEffect(()=>{
  try{
   const stored=JSON.parse(window.localStorage.getItem('trustfive-shortlist-v1')||'[]');
   if(Array.isArray(stored))setShortlistIds(stored.filter((id):id is string=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)).slice(0,3));
  }catch{/* Unsupported or private browsing storage must never block finding trades. */}
  setShortlistReady(true);
 },[]);
 useEffect(()=>{
  if(!shortlistReady)return;
  try{window.localStorage.setItem('trustfive-shortlist-v1',JSON.stringify(shortlistIds));}catch{/* Browser storage is optional. */}
 },[shortlistIds,shortlistReady]);

 const visible=useMemo(()=>{
  const list=[...pros];
  if(sort==='recommended'&&location)return list;
  if(sort==='nearby'&&location)list.sort((a,b)=>(a.distance_km??Infinity)-(b.distance_km??Infinity)||b.quality_score-a.quality_score);
  else if(sort==='reviews')list.sort((a,b)=>b.review_count-a.review_count||b.quality_score-a.quality_score);
  else if(sort==='name')list.sort((a,b)=>a.business_name.localeCompare(b.business_name));
  else list.sort((a,b)=>b.quality_score-a.quality_score||b.review_count-a.review_count);
  return list;
 },[pros,sort,location]);
 const compareVisible=visible.filter(p=>shortlistIds.includes(p.application_id));
 function toggleShortlist(id:string){
  if(shortlistIds.includes(id)){setShortlistIds(current=>current.filter(item=>item!==id));setShortlistNotice('Removed from your comparison.');return;}
  if(shortlistIds.length>=3){setShortlistNotice('You can compare up to three approved professionals. Remove one first.');return;}
  setShortlistIds(current=>[...current,id]);setShortlistNotice('Added to your comparison.');
 }
 const tradeEntry=trades.find(t=>t.id===trade);
 const areaEntry=areas.find(a=>a.id===area);
 const jobParams=new URLSearchParams();
 if(tradeEntry)jobParams.set('trade',tradeEntry.slug);
 if(areaEntry)jobParams.set('area',areaEntry.id);
 const jobHref='/jobs'+(jobParams.size?'?'+jobParams.toString():'');
 function clearFilters(){setTrade('');setArea('');setLocation(null);setAddressVersion(v=>v+1);setSearchHint('');setSort('quality');window.history.replaceState(null,'','/services');}
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
  <FairSelectionNotice />
  <div className="directory-layout">
   <aside className="directory-filters" aria-label="Filter professionals">
    <div className="directory-filter-heading"><h2>Find your match</h2><button type="button" className="directory-reset" onClick={clearFilters}>Clear filters</button></div>
    <label htmlFor="directory-trade">Trade or service</label>
    <select id="directory-trade" value={trade} onChange={e=>updateTrade(e.target.value)} disabled={catalogLoading}>
     <option value="">All services</option>{trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
    <AddressSearch key={addressVersion} onSelect={point=>{setLocation(point);setSort(point?'recommended':'quality');if(point){setArea('');const p=new URLSearchParams(window.location.search);p.delete('area');window.history.replaceState(null,'','/services'+(p.size?'?'+p.toString():''));}}}/>
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
       {location&&<><option value="recommended">Recommended: distance & ratings</option><option value="nearby">Closest first</option></>}<option value="quality">Quality score</option><option value="reviews">Most completed-job reviews</option><option value="name">Business name A–Z</option>
      </select>
     </label>
    </div>
    {resultsError&&<div role="alert" className="notice error"><p>Professional search unavailable. {resultsError}</p><button type="button" className="btn secondary" onClick={()=>setRetryVersion(v=>v+1)}>Try searching again</button></div>}
    {resultsLoading?<p role="status" className="directory-loading">Searching approved professionals…</p>:
     <p className="directory-count" role="status">{visible.length} approved professional{visible.length===1?'':'s'} matching your filters</p>}

    {shortlistNotice&&<p className="muted-note" role="status">{shortlistNotice}</p>}
    {shortlistIds.length>0&&<section className="directory-compare" aria-labelledby="directory-compare-title">
     <div className="directory-compare-heading"><div><h3 id="directory-compare-title">Compare approved professionals</h3><p className="muted-note">{shortlistIds.length} saved on this browser · Maximum 3 · Only currently eligible matching results are shown</p></div><button type="button" className="btn secondary" onClick={()=>{setShortlistIds([]);setShortlistNotice('Comparison cleared.');}}>Clear comparison</button></div>
     {compareVisible.length===0?<p className="muted-note">Your saved selections are not in these current verified search results. Change your search to find eligible providers; saved entries are never treated as proof of current approval.</p>:
     <div className="directory-compare-grid">{compareVisible.map(p=><article className="directory-compare-card" key={p.application_id}>
      <h4>{p.business_name}</h4><span className="pill">Currently approved in these results</span>
      <p>{p.trade_name} · {p.area_name}</p>
      <dl><div><dt>Independent quality</dt><dd>{p.quality_score}/100</dd></div><div><dt>Verified booking reviews</dt><dd>{p.review_count>0?Number(p.average_stars).toFixed(1)+'/5 ('+p.review_count+')':'None yet'}</dd></div>{location&&p.distance_km!=null&&<div><dt>Approximate distance</dt><dd>{Number(p.distance_km).toFixed(1)} km</dd></div>}</dl>
      <Link className="btn secondary" href={'/business/'+p.application_id}>View full profile</Link>
      <button type="button" className="directory-compare-remove" onClick={()=>toggleShortlist(p.application_id)}>Remove from comparison</button>
     </article>)}</div>}
    </section>}
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
       <div className="directory-pro-actions"><Link className="btn secondary" href={'/business/'+p.application_id}>View business profile</Link><button type="button" className="btn secondary" aria-pressed={shortlistIds.includes(p.application_id)} onClick={()=>toggleShortlist(p.application_id)}>{shortlistIds.includes(p.application_id)?'✓ In comparison':'+ Compare'}</button><Link href={jobHref}>Post a job →</Link></div>
      </div>
     </article>)}</div>}
    {!resultsLoading&&!resultsError&&visible.length===0&&
     <DirectoryEmptyState context={{hasLocation:Boolean(location),hasTrade:Boolean(trade),hasArea:Boolean(area)}} onReset={clearFilters} jobHref={jobHref}/>}

   </section>
  </div>
 </main>;
}
