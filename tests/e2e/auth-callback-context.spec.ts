import {test,expect} from '@playwright/test';
import {NextRequest} from 'next/server';
import {handleAuthCallback} from '../../lib/auth-callback-handler';

const base='http://localhost:3112';
const selected='/jobs?trade=cctv-installation&area=verified-area';
const request=(search:string)=>new NextRequest(base+'/auth/callback'+search);

test('Successful callback keeps the validated trade and area return path',async()=>{
  const response=await handleAuthCallback(request('?code=test-code&next='+encodeURIComponent(selected)),async()=>({error:null}));
  const location=new URL(response.headers.get('location')!,base);
  expect(location.pathname+location.search).toBe(selected);
});

test('Missing authorization code preserves a safe next on the account page',async()=>{
  const response=await handleAuthCallback(request('?next='+encodeURIComponent(selected)),async()=>({error:null}));
  const location=new URL(response.headers.get('location')!,base);
  expect(location.pathname).toBe('/account');
  expect(location.searchParams.get('next')).toBe(selected);
});

test('Failed code exchange preserves a safe next without leaking code or error text',async()=>{
  const response=await handleAuthCallback(
    request('?code=secret-code&next='+encodeURIComponent(selected)),
    async()=>({error:{message:'exchange failed for secret-code'}})
  );
  const header=response.headers.get('location')!;
  const location=new URL(header,base);
  expect(location.pathname).toBe('/account');
  expect(location.searchParams.get('next')).toBe(selected);
  expect(header).not.toContain('secret-code');
  expect(header).not.toContain('exchange failed');
});

test('Password reset return path survives a failed exchange',async()=>{
  const response=await handleAuthCallback(
    request('?code=secret-code&next='+encodeURIComponent('/auth/update-password')),
    async()=>({error:{message:'exchange failed'}})
  );
  const location=new URL(response.headers.get('location')!,base);
  expect(location.pathname).toBe('/account');
  expect(location.searchParams.get('next')).toBe('/auth/update-password');
});

test('Malicious external next fails closed on success, missing-code and failure paths',async()=>{
  const malicious=[
    'https://outside.example/steal',
    '//outside.example/steal',
    '/jobs/../admin',
    '/jobs#fragment'
  ];
  for(const next of malicious){
    for(const search of [
      '?code=test-code&next='+encodeURIComponent(next),
      '?next='+encodeURIComponent(next),
      '?code=test-code&next='+encodeURIComponent(next)
    ]){
      const response=await handleAuthCallback(request(search),async(code)=>(
        code==='test-code'?{error:{message:'exchange failed'}}:{error:null}
      ));
      const location=new URL(response.headers.get('location')!,base);
      expect(location.origin).toBe(base);
      expect(location.pathname).toBe('/account');
      expect(location.searchParams.get('next')).toBe('/dashboard');
    }
  }
});

test('Cookies written before a failed exchange are retained on the retry redirect',async()=>{
  const response=await handleAuthCallback(
    request('?code=test-code&next='+encodeURIComponent(selected)),
    async(_code,setCookies)=>{
      setCookies([{name:'test-auth-state',value:'cleared',options:{path:'/',httpOnly:true}}]);
      return {error:{message:'exchange failed'}};
    }
  );
  const setCookie=response.headers.get('set-cookie')||'';
  expect(setCookie).toContain('test-auth-state=cleared');
});
