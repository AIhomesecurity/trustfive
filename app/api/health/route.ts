import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
 const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 const commitSha=process.env.TRUSTFIVE_BUILD_SHA;
 return NextResponse.json({service:'trustfive-web',status:configured?'ok':'configuration_required',timestamp:new Date().toISOString(),...(commitSha&&/^[a-f0-9]{40}$/.test(commitSha)?{commitSha}:{})},{
  status:configured?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 });
}
