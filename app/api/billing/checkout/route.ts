import {NextRequest,NextResponse} from 'next/server';
import Stripe from 'stripe';
import {supabaseServer} from '../../../../lib/supabase-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function reply(message:string,status:number){
 return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
 const secret=process.env.STRIPE_SECRET_KEY;
 const priceId=process.env.STRIPE_MEMBERSHIP_PRICE_ID;
 const base=process.env.TRUSTFIVE_APP_URL;
 if(!secret?.startsWith('sk_test_')||!priceId?.startsWith('price_')||!base)
  return reply('Stripe test mode has not been configured. No charge was attempted.',503);
 let origin:string;
 try{const parsed=new URL(base);origin=parsed.origin;
  if(parsed.protocol!=='https:'&&parsed.hostname!=='localhost')throw Error('HTTPS required');
 }catch{return reply('Invalid site URL configuration',503);}
 if(request.headers.get('origin')!==origin)return reply('Invalid request origin',403);
 try{
  const supabase=await supabaseServer();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return reply('Sign in required',401);
  const [profile,membership]=await Promise.all([
   supabase.from('profiles').select('requested_role').eq('id',user.id).single(),
   supabase.from('business_memberships').select('subscription_status').eq('user_id',user.id).maybeSingle()
  ]);
  if(profile.error||membership.error)return reply('Unable to verify account eligibility',503);
  if(profile.data?.requested_role!=='professional')
   return reply('Professional account required',403);
  if(['active','trialing'].includes(membership.data?.subscription_status||''))
   return reply('You already have an active software membership',409);
  const stripe=new Stripe(secret);
  const price=await stripe.prices.retrieve(priceId);
  if(!price.active||price.currency!=='gbp'||price.unit_amount!==1999
   ||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)
   return reply('Stripe product must be exactly £19.99 per month in GBP',503);
  const session=await stripe.checkout.sessions.create({
   mode:'subscription',line_items:[{price:priceId,quantity:1}],
   customer_email:user.email||undefined,
   client_reference_id:user.id,
   subscription_data:{metadata:{trustfive_user_id:user.id,product:'business_software'}},
   success_url:origin+'/billing?result=returned',
   cancel_url:origin+'/billing?result=cancelled'
  });
  if(!session.url)return reply('Checkout session URL not available',502);
  return NextResponse.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return reply('Membership checkout is unavailable. No charge was confirmed.',503);
 }
}
