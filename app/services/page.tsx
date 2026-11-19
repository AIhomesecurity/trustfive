'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
type Trade={id:string;name:string;slug:string};
type Area={id:string;area_name:string;city:string;country_code:string};
type Professional={application_id:string;business_name:string;about:string|null;trade_name:string;area_name:string;city:string;quality_score:number;slot:number;average_stars:number;review_count:number};
export default function Services(){
 const [trades,setTrades]=useState<Trade[]>([]),[areas,setAreas]=useState<Area[]>([]);
 const [trade,setTrade]=useState(''),[area,setArea]=useState('');
 const [pros,setPros]=useState<Professional[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{const s=supabaseBrowser();const [t,a]=await Promise.all([s.from('trades').select('id,name,slug').order('name'),s.from('service_areas').select('id,area_name,city,country_code').order('city')]);if(t.error)throw t.error;if(a.error)throw a.error;setTrades(t.data||[]);setAreas(a.data||[])}catch(e){setError(e instanceof Error?e.message:'Cannot load catalogues')}finally{setLoading(false)}})()},[]);
 useEffect(()=>{let active=true;(async()=>{try{setError('');const {data,error}=await supabaseBrowser().rpc('find_trustfive_professionals_with_reviews',{p_trade:trade||null,p_area:area||null});if(error)throw error;if(active)setPros(data||[])}catch(e){if(active)setError(e instanceof Error?e.message:'Search unavailable')}})();return()=>{active=false}},[trade,area]);
 return <main className="container"><div className="page-heading"><span className="eyebrow">Independently selected local talent</span><h1>Find a TrustFive professional</h1><p className="subtle">Only currently verified and approved professionals appear here. Nobody can pay to improve a ranking.</p></div>
 <div className="card form-grid"><label>Service<select value={trade} onChange={e=>setTrade(e.target.value)}><option value="">All trades</option>{trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Local service area<select value={area} onChange={e=>setArea(e.target.value)}><option value="">All areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label></div>
 {loading&&<p>Loading services…</p>}{error&&<p role="alert" className="notice error">{error}. Apply the database migrations and check Supabase configuration.</p>}
 <section className="section"><h2>Approved professionals</h2><p className="subtle">Maximum five approved places per trade and service area; display order uses independently reviewed quality scores.</p>
 <div className="grid">{pros.map(p=><div className="card" key={p.application_id}><span className="pill">TrustFive approved · {p.quality_score}/100</span><h3 style={{marginTop:15}}>{p.business_name}</h3><p>{p.trade_name} · {p.area_name}, {p.city}</p><p style={{marginTop:10}}>{p.about||'Approved local professional'}</p><p style={{marginTop:10}}>{p.review_count>0?'★ '+Number(p.average_stars).toFixed(1)+' / 5 · '+p.review_count+' completed-booking reviews':'No completed-booking reviews yet'}</p><p style={{marginTop:12}} className="muted-note">Approved allocation slot {p.slot} of 5</p><p style={{marginTop:14}}><Link className="btn secondary" href={'/business/'+p.application_id}>Business profile</Link></p></div>)}</div>
 {!loading&&!error&&pros.length===0&&<div className="card"><h3>We're building the trusted network here</h3><p>No verified, active professionals match those filters yet. We do not show made-up ratings or unapproved profiles.</p><p style={{marginTop:15}}><Link className="btn secondary" href="/professional/apply">Apply to join the network</Link></p></div>}</section></main>
}