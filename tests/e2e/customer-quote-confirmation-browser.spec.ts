import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';

const backend='http://127.0.0.1:54321';
const app='http://127.0.0.1:3112';
const user={id:'aaaaaaaa-0000-4000-8000-000000000001',aud:'authenticated'};
const jobId='bbbbbbbb-0000-4000-8000-000000000001';
const quoteId='cccccccc-0000-4000-8000-000000000001';
const bookingId='dddddddd-0000-4000-8000-000000000001';
const token='synthetic-quote-confirmation-token';

test.use({viewport:{width:360,height:740},isMobile:true,hasTouch:true});
test('signed-in customer can cancel and confirm a quote by keyboard after a reload failure and manage private address consent after booking recovery',async({page})=>{
 test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL!==backend,'Requires the isolated loopback application build.');
 test.setTimeout(60000);
 page.setDefaultTimeout(10000);
 let accepted=0;
 let acceptanceAttempts=0;
 let failRefresh=false;
 let appointmentLookups=0;
 const consentChanges:boolean[]=[];
 const fixture=createServer(async(request,response)=>{
  const path=new URL(request.url??'/',backend).pathname;
  const reply=(status:number,data:unknown)=>{
   response.writeHead(status,{
    'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'GET,POST,OPTIONS','content-type':'application/json',
   });
   response.end(status===204?'':JSON.stringify(data));
  };
  if(request.method==='OPTIONS')return reply(204,null);
  if(request.headers.authorization!=='Bearer '+token)return reply(401,{message:'Synthetic session required'});
  switch(path){
   case '/auth/v1/user':return reply(200,user);
   case '/rest/v1/jobs':
    if(failRefresh){failRefresh=false;return reply(500,{message:'Synthetic refresh failure'});}
    return reply(200,[{id:jobId,title:'Synthetic CCTV installation',description:'Fit a new synthetic camera.',
     status:accepted?'booked':'open',created_at:'2026-11-23T00:00:00Z',budget_pence:null}]);
   case '/rest/v1/rpc/customer_quotes':
    return reply(200,[{quote_id:quoteId,job_id:jobId,business_name:'Synthetic trade business',
     amount_pence:22500,message:'Includes installation.',status:accepted?'accepted':'pending'}]);
   case '/rest/v1/rpc/accept_job_quote':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    if(raw!==JSON.stringify({p_quote:quoteId})||accepted)return reply(400,{message:'Unexpected quote acceptance'});
    if(++acceptanceAttempts===1)return reply(500,{message:'Synthetic acceptance outage'});
    accepted++;failRefresh=true;
    return reply(200,bookingId);
   }
   case '/rest/v1/job_bookings':
    return reply(200,accepted?[{id:bookingId,job_id:jobId,quote_id:quoteId,customer_id:user.id,
     professional_id:'eeeeeeee-0000-4000-8000-000000000001',status:'booked',created_at:'2026-11-23T00:00:00Z'}]:[]);
   case '/rest/v1/booking_appointments':
    appointmentLookups++;
    if(appointmentLookups<=2)return reply(500,{message:'Synthetic appointment outage'});
    return reply(200,[]);
   case '/rest/v1/rpc/booking_job_site_address':
    return reply(200,[{address_label:'Synthetic private address',postcode:'SW1A 1AA',sharing_enabled:consentChanges.at(-1)??false}]);
   case '/rest/v1/rpc/set_booking_address_sharing':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    const {p_booking,p_allow}=JSON.parse(raw);
    if(p_booking!==bookingId||typeof p_allow!=='boolean')return reply(400,{message:'Unexpected synthetic consent'});
    consentChanges.push(p_allow);
    return reply(200,null);
   }
   default:return reply(200,[]);
  }
 });

 // Other signed-in browser specs can briefly own the fixture port.
 for(let attempt=0;;attempt++){
  try{await once(fixture.listen(54321,'127.0.0.1'),'listening');break;}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EADDRINUSE'||attempt>=80)throw error;
   await delay(250);
  }
 }
 try{
  const session={access_token:token,refresh_token:'synthetic-refresh',
   expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
  await page.context().addCookies([{name:'sb-127-auth-token',
   value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:app}]);
  await page.goto('/jobs');
  const review=page.getByRole('button',{name:'Review and accept quote'});
  const confirmation=page.getByRole('group',{name:'Confirm quote from Synthetic trade business'});
  await review.press('Enter');
  await expect(confirmation.getByRole('button',{name:'Cancel'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(review).toBeFocused();
  expect(accepted).toBe(0);

  await review.press('Enter');
  await confirmation.getByRole('button',{name:'Confirm and create booking'}).press('Enter');
  const acceptanceError=confirmation.getByRole('alert');
  await expect(acceptanceError).toHaveText('Could not confirm the booking. Check your connection and try again.');
  await expect(acceptanceError).toBeFocused();
  expect(accepted).toBe(0);
  await confirmation.getByRole('button',{name:'Confirm and create booking'}).press('Enter');
  const confirmed=page.getByRole('link',{name:'Open your confirmed booking'});
  await expect(confirmed).toBeFocused();
  await expect(confirmed).toHaveAttribute('href','/bookings?booking='+bookingId);
  await expect(page.getByText('The jobs list could not be refreshed.',{exact:false})).toBeVisible();
  await expect(review).toHaveCount(0);
  expect(accepted).toBe(1);
  expect(acceptanceAttempts).toBe(2);

  await page.reload();
  const booking=page.getByRole('link',{name:'Manage confirmed booking'});
  await expect(booking).toHaveAttribute('href','/bookings?booking='+bookingId);
  await booking.click();
  await expect(page.getByTestId('bookings-load-error')).toContainText('Unable to check appointment times');
  await expect(page.getByTestId('count-active')).toHaveCount(0);
  await page.getByRole('button',{name:'Retry loading bookings'}).click();
  await expect(page.getByRole('button',{name:'Retry loading bookings'})).toBeEnabled();
  await expect(page.getByTestId('bookings-load-error')).toBeVisible();
  await page.getByRole('button',{name:'Retry loading bookings'}).click();
  await expect(page.getByTestId('bookings-load-error')).toHaveCount(0);
  await expect(page.getByTestId('count-active')).toBeVisible();
  await expect(page).toHaveURL(/booking=dddddddd-0000-4000-8000-000000000001$/);
  expect(appointmentLookups).toBe(3);

  const share=page.getByRole('button',{name:'Share exact address with booked professional'});
  await share.press('Enter');
  await expect(page.getByRole('button',{name:'Keep private'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(share).toBeFocused();
  expect(consentChanges).toEqual([]);
  await share.press('Enter');
  await page.getByRole('button',{name:'Confirm share address'}).click();
  await expect(page.getByText('Sharing is active',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Turn off exact address sharing'}).click();
  await expect(share).toBeVisible();
  expect(consentChanges).toEqual([true,false]);
 }finally{
  await new Promise<void>((resolve,reject)=>{
   fixture.close(error=>error?reject(error):resolve());
   fixture.closeAllConnections();
  });
 }
});
