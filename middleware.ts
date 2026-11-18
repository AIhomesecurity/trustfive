import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
type CookieWrite={name:string;value:string;options?:{path?:string;domain?:string;maxAge?:number;expires?:Date;httpOnly?:boolean;secure?:boolean;sameSite?:boolean|'lax'|'strict'|'none'}};
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return response;
 const s=createServerClient(url,key,{cookies:{
  getAll(){return request.cookies.getAll()},
  setAll(all:CookieWrite[]){all.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});all.forEach(({name,value,options})=>response.cookies.set(name,value,options))}
 }});
 const {data:{user}}=await s.auth.getUser();
 if(!user&&/^\/(profile|jobs|professional|community|admin)(\/|$)/.test(request.nextUrl.pathname)){
  const next=request.nextUrl.clone();next.pathname='/account';next.search='';return NextResponse.redirect(next);
 }
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)']};
