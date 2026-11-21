import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(payload:Record<string,unknown>,status=200){
 return NextResponse.json(payload,{status,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){
 const secret=process.env.STRIPE_SECRET_KEY;
 const signingSecret=process.env.STRIPE_WEBHOOK_SECRET;
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret?.startsWith('sk_test_')||!signingSecret?.startsWith('whsec_')
   ||!supabaseUrl||!serviceKey)
  return reply({error:'Test webhook is not configured'},503);
 const signature=request.headers.get('stripe-signature');
 if(!signature)return reply({error:'Missing signature'},400);
 let event:Stripe.Event;
 try{
  const body=await request.text();
  event=new Stripe(secret).webhooks.constructEvent(body,signature,signingSecret);
 }catch{
  return reply({error:'Invalid signature'},400);
 }
 if(event.livemode){
  return reply({error:'Live Stripe events are disabled until owner approval'},403);
 }
 if(![
   'customer.subscription.created',
   'customer.subscription.updated',
   'customer.subscription.deleted'
 ].includes(event.type))return reply({received:true});

 const sub=event.data.object as Stripe.Subscription;
 const owner=sub.metadata?.trustfive_user_id;
 if(!owner||!uuid.test(owner)||sub.metadata?.product!=='business_software'){
  return reply({received:true,ignored:true});
 }
 const customer=typeof sub.customer==='string'?sub.customer:sub.customer?.id;
 if(!customer)return reply({error:'Missing Stripe customer'},422);
 try{
  const supabase=createClient(supabaseUrl,serviceKey,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {error}=await supabase.rpc('apply_membership_stripe_event',{
   p_event_id:event.id,
   p_event_created_at:new Date(event.created*1000).toISOString(),
   p_user_id:owner,p_customer_id:customer,
   p_subscription_id:sub.id,p_status:sub.status
  });
  if(error)throw error;
  return reply({received:true});
 }catch{
  // 5xx allows Stripe to retry. Never mark unprocessed events successful.
  return reply({error:'Webhook processing failed'},503);
 }
}
