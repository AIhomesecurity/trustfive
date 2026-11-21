import {NextRequest,NextResponse} from 'next/server';
import {safeAuthReturnPath} from './auth-return-path';
export type CookieWrite={name:string;value:string;options?:{path?:string;domain?:string;maxAge?:number;expires?:Date;httpOnly?:boolean;secure?:boolean;sameSite?:boolean|'lax'|'strict'|'none'}};
export type ExchangeResult={error:{message:string}|null};

// The exchange is injected so the failure paths can be tested with a fake
// Supabase response. No code, error message or token is ever put in a URL.
export async function handleAuthCallback(
 request:NextRequest,
 exchange:(code:string,setCookies:(cookies:CookieWrite[])=>void)=>Promise<ExchangeResult>
):Promise<NextResponse>{
 const code=request.nextUrl.searchParams.get('code');
 // Only these internal destinations are allowed; never redirect to user-supplied hosts.
 const requested=request.nextUrl.searchParams.get('next');
 const next=safeAuthReturnPath(requested,true);
 const response=NextResponse.redirect(new URL(next,request.url));
 const retryWithContext=()=>{
  const target=new URL('/account',request.url);
  target.searchParams.set('next',next);
  const redirect=NextResponse.redirect(target);
  // Keep cookies written before an exchange failure so the retry starts clean.
  for(const cookie of response.cookies.getAll())redirect.cookies.set(cookie);
  return redirect;
 };
 if(!code)return retryWithContext();
 const {error}=await exchange(code,cookies=>cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options)));
 return error?retryWithContext():response;
}
