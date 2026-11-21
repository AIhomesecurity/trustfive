import {NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {handleAuthCallback} from '../../../lib/auth-callback-handler';

export async function GET(request:NextRequest){
 return handleAuthCallback(request,async(code,setCookies)=>{
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
   cookies:{getAll(){return request.cookies.getAll()},setAll:setCookies}
  });
  return supabase.auth.exchangeCodeForSession(code);
 });
}
