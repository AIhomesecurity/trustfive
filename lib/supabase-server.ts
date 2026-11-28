import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';

type CookieWrite={name:string;value:string;options?:{
 path?:string;domain?:string;maxAge?:number;expires?:Date;httpOnly?:boolean;secure?:boolean;
 sameSite?:boolean|'lax'|'strict'|'none'
}};

export async function supabaseServer(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('Missing Supabase public configuration');
 const jar=await cookies();
 return createServerClient(url,key,{cookies:{
  getAll(){return jar.getAll();},
  setAll(all:CookieWrite[]){all.forEach(({name,value,options})=>jar.set(name,value,options));}
 }});
}
