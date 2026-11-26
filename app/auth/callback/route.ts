import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {safeAuthReturnPath} from '../../../lib/auth-return-path';
type CookieWrite={name:string;value:string;options?:{path?:string;domain?:string;maxAge?:number;expires?:Date;httpOnly?:boolean;secure?:boolean;sameSite?:boolean|'lax'|'strict'|'none'}};
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');
 const oauthErr=request.nextUrl.searchParams.get('error');
 // Only these internal destinations are allowed; never redirect to user-supplied hosts.
 const requested=request.nextUrl.searchParams.get('next');
 const next=safeAuthReturnPath(requested,true);
 const response=NextResponse.redirect(new URL(next,request.url));
 if(oauthErr)return NextResponse.redirect(new URL('/account?auth_error=callback_failed',request.url));
 if(!code)return NextResponse.redirect(new URL('/account',request.url));
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll(){return request.cookies.getAll()},setAll(cookies:CookieWrite[]){cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}
 });
 const {error}=await supabase.auth.exchangeCodeForSession(code);
 return error?NextResponse.redirect(new URL('/account?auth_error=callback_failed',request.url)):response;
}
