'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {safeAuthReturnPath} from '../../lib/auth-return-path';
import {
  fetchEnabledOAuthProviders,
  safeAuthCallbackError,
  type OAuthProviderAvailability,
  type OAuthProviderKey,
} from '../../lib/auth-providers';

function jobReturnPath():string{
 if(typeof window==='undefined')return '/dashboard';
 return safeAuthReturnPath(new URLSearchParams(window.location.search).get('next'));
}

export default function Account(){
 const [mode,setMode]=useState<'signup'|'signin'>('signup'),[role,setRole]=useState<'customer'|'professional'>('customer');
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [providers,setProviders]=useState<OAuthProviderAvailability>({google:false,apple:false,checked:false});

 useEffect(()=>{
  const cbErr=safeAuthCallbackError(window.location.search);
  if(cbErr)setMessage(cbErr);
  let active=true;
  void fetchEnabledOAuthProviders(
   process.env.NEXT_PUBLIC_SUPABASE_URL,
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ).then(result=>{
   if(active)setProviders(result);
  });
  return()=>{active=false;};
 },[]);

 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{
  const s=supabaseBrowser();
  if(mode==='signup'){
    if(name.trim().length<2)throw Error('Please enter your full name');
    const {data,error}=await s.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/auth/callback?next='+encodeURIComponent(jobReturnPath()),data:{full_name:name.trim(),phone:phone.trim(),requested_role:role}}});
    if(error)throw error;
    if(data.session){location.assign(jobReturnPath());return}
    setMessage('Account created. Check your email for the confirmation link before signing in.');
  }else{
    const {error}=await s.auth.signInWithPassword({email,password});
    if(error)throw error;
    location.assign(jobReturnPath());
  }
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to continue')}finally{setBusy(false)}}

 async function oauth(provider:OAuthProviderKey){
  setMessage('');
  if(!providers[provider]){
   const label=provider==='google'?'Google':'Apple';
   setMessage(`${label} sign-in is not enabled on this Supabase project yet. Use email and password above to continue now.`);
   return;
  }
  try{
   const {error}=await supabaseBrowser().auth.signInWithOAuth({
    provider,
    options:{redirectTo:location.origin+'/auth/callback?next='+encodeURIComponent(jobReturnPath())}
   });
   if(error)throw error;
  }catch(e){
   setMessage(e instanceof Error?e.message:'OAuth login unavailable. Please sign in with email and password above.');
  }
 }

 const anyOAuthEnabled=providers.google||providers.apple;

 return <main className="container" style={{maxWidth:560,paddingTop:50}}>
 <div className="card" style={{padding:32}}><span className="eyebrow">Welcome to TrustFive</span><h1>{mode==='signup'?'Create your account':'Sign in to TrustFive'}</h1><p className="subtle">One secure login for the marketplace and neighbourhood community.</p>
 <div style={{display:'flex',gap:10,marginBottom:24}}><button type="button" className={'btn '+(mode==='signup'?'':'secondary')} onClick={()=>setMode('signup')}>Create account</button><button type="button" className={'btn '+(mode==='signin'?'':'secondary')} onClick={()=>setMode('signin')}>Sign in</button></div>
 <form className="form" onSubmit={submit}>
 {mode==='signup'&&<><label>I am joining as<select value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="customer">Customer / neighbour</option><option value="professional">Professional applicant</option></select></label><label>Full name<input required autoComplete="name" minLength={2} maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label><label>Phone number<input required type="tel" autoComplete="tel" minLength={7} maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+44 …"/></label></>}
 <label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Password<input required minLength={10} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button className="btn" type="submit" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create free account':'Sign in'}</button></form>
 {message&&<p role="status" className="notice">{message}</p>}
 {mode==='signin'&&<p><Link href="/account/reset">Forgot your password?</Link></p>}
 <hr style={{border:'none',borderTop:'1px solid #dae9df',margin:'25px 0'}}/>
 {anyOAuthEnabled?(
  <div data-testid="oauth-providers-active">
   <p className="muted-note">Or continue with a connected account:</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {providers.google&&<button className="btn secondary" type="button" onClick={()=>void oauth('google')}>Continue with Google</button>}
    {providers.apple&&<button className="btn secondary" type="button" onClick={()=>void oauth('apple')}>Continue with Apple</button>}
   </div>
  </div>
 ):(
  <p className="muted-note" data-testid="oauth-providers-unavailable">
   Email and password sign-in is active now. Google and Apple one-tap sign-in will appear automatically once enabled in Supabase Auth Providers.
  </p>
 )}
 <p className="muted-note">Professional sign-up is free. Choosing professional does not grant an approved TrustFive slot. OAuth members can apply for a professional account after signing in.</p>
 </div></main>;
}
