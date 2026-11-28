import {expect,test} from '@playwright/test';
import {NextRequest} from 'next/server.js';
import {middleware} from '../../middleware';

const origin='https://trustfive.test';
const supabaseUrl='https://fixture.supabase.co';
const user={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',aud:'authenticated'};
const session={
 access_token:'fixture-access-token',
 refresh_token:'fixture-refresh-token',
 expires_in:3600,
 expires_at:Math.floor(Date.now()/1000)+3600,
 token_type:'bearer',
 user
};
const sessionCookie='sb-fixture-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');

test('account middleware resumes a validated signed-in return and leaves recovery accessible',async()=>{
 const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const previousFetch=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL=supabaseUrl;
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';
 globalThis.fetch=async(input,init)=>{
  expect(String(input)).toBe(supabaseUrl+'/auth/v1/user');
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-access-token');
  return Response.json(user);
 };
 try{
  const destination='/jobs?trade=cctv&area=leeds';
  const signedIn=new NextRequest(origin+'/account?next='+encodeURIComponent(destination),{headers:{cookie:sessionCookie}});
  expect((await middleware(signedIn)).headers.get('location')).toBe(origin+destination);

  const unsafe=new NextRequest(origin+'/account?next='+encodeURIComponent('//example.test'),{headers:{cookie:sessionCookie}});
  expect((await middleware(unsafe)).headers.get('location')).toBe(origin+'/dashboard');

  const recovery=new NextRequest(origin+'/account/reset',{headers:{cookie:sessionCookie}});
  expect((await middleware(recovery)).headers.get('location')).toBeNull();
  expect((await middleware(new NextRequest(origin+'/account'))).headers.get('location')).toBeNull();
 }finally{
  globalThis.fetch=previousFetch;
  if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey;
 }
});
