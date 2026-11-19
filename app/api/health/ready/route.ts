import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Deep readiness probe for staging verification only.
 * It never discloses credentials, table rows or provider error details.
 */
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key){
  return NextResponse.json({service:'trustfive-web',ready:false,backend:'not_configured'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
 try{
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await supabase.from('trades').select('id').limit(1)
   .abortSignal(AbortSignal.timeout(5000));
  if(error)throw error;
  return NextResponse.json({service:'trustfive-web',ready:true,backend:'supabase_query_ok'},
   {headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({service:'trustfive-web',ready:false,backend:'unavailable'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
