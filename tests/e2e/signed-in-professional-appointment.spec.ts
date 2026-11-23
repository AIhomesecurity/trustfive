import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';

const backend='http://127.0.0.1:54321';
const app='http://127.0.0.1:3112';
const professional={id:'aaaaaaaa-0000-4000-8000-000000000020',aud:'authenticated'};
const jobId='bbbbbbbb-0000-4000-8000-000000000020';
const allocationId='cccccccc-0000-4000-8000-000000000020';
const quoteId='dddddddd-0000-4000-8000-000000000020';
const bookingId='eeeeeeee-0000-4000-8000-000000000020';
const token='synthetic-professional-appointment-token';

test.use({viewport:{width:360,height:740},isMobile:true,hasTouch:true});
test('signed-in professional retries eligible leads, submits a quote and proposes a time after calendar recovery',async({page})=>{
 test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL!==backend,'Requires the isolated loopback application build.');
 test.setTimeout(60000);
 page.setDefaultTimeout(10000);
 let leadOutage=true;
 let writes=0;
 let quoteOutage=true;
 let initialBusinessOutage=true;
 let onboardingOutage=true;
 let draftInserts=0;
 let draftUpdates=0;
 let reviewSubmissions=0;
 const draftApplication="ffffffff-0000-4000-8000-000000000020";
 let calendarOutage=true;
 let proposalOutage=true;
 let cancellationAttempts=0;
 let proposal: {booking_id:string;proposed_by:string;starts_at:string;ends_at:string;timezone_name:string;status:string}|null=null;
 const fixture=createServer(async(request,response)=>{
  const path=new URL(request.url??'/',backend).pathname;
  const reply=(status:number,data:unknown)=>{
   response.writeHead(status,{
    'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','content-type':'application/json',
   });
   response.end(status===204?'':JSON.stringify(data));
  };
  if(request.method==='OPTIONS')return reply(204,null);
  if(request.headers.authorization!=='Bearer '+token)return reply(401,{message:'Synthetic session required'});
  switch(path){
   case '/auth/v1/user':return reply(200,professional);
   case '/rest/v1/rpc/open_jobs_for_professional':
    if(leadOutage){leadOutage=false;return reply(500,{message:'Synthetic lead outage'});}
    return reply(200,writes?[]:[{job_id:jobId,title:'Synthetic CCTV installation',
     description:'Install a synthetic camera in a verified fixture area.',budget_pence:null,
     trade_name:'CCTV installation',area_name:'Synthetic area',allocation_id:allocationId}]);
   case '/rest/v1/job_quotes':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    const quote=JSON.parse(raw);
    if(writes||quote.job_id!==jobId||quote.professional_id!==professional.id||
     quote.professional_allocation_id!==allocationId||quote.amount_pence!==22500||
     quote.availability_note!=='Tuesday morning'||quote.status!=='pending'){
     return reply(400,{message:'Unexpected synthetic quote'});
    }
    if(quoteOutage){quoteOutage=false;return reply(503,{message:'Synthetic quote outage'});}
    writes++;
    return reply(201,null);
   }
   // The fixture simulates the customer accepting the submitted quote before refresh.
   case '/rest/v1/rpc/professional_quotes':
    return reply(200,writes?[{quote_id:quoteId,job_id:jobId,job_title:'Synthetic CCTV installation',
     amount_pence:22500,message:'Install the synthetic camera.',status:'accepted'}]:[]);
   case '/rest/v1/job_bookings':
    return reply(200,writes?[{id:bookingId,quote_id:quoteId,customer_id:'synthetic-customer',
     professional_id:professional.id,status:'booked'}]:[]);
   case '/rest/v1/booking_appointments':
    if(calendarOutage){calendarOutage=false;return reply(500,{message:'Synthetic calendar outage'});}
    return reply(200,proposal?[proposal]:[]);
   case '/rest/v1/rpc/propose_booking_appointment':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    const {p_booking,p_start,p_end,p_timezone}=JSON.parse(raw);
    if(proposal||p_booking!==bookingId||p_timezone!=='Europe/London'||!(Date.parse(p_end)>Date.parse(p_start))){
     return reply(400,{message:'Unexpected appointment proposal'});
    }
    if(proposalOutage){proposalOutage=false;return reply(503,{message:'Synthetic proposal outage'});}
    proposal={booking_id:p_booking,proposed_by:professional.id,starts_at:p_start,ends_at:p_end,
     timezone_name:p_timezone,status:'proposed'};
    return reply(200,null);
   }
   case '/rest/v1/rpc/cancel_booking_appointment':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    if(JSON.parse(raw).p_booking!==bookingId||proposal?.status!=='proposed')return reply(400,{message:'Unexpected cancellation'});
    if(++cancellationAttempts===1)return reply(400,{message:'Synthetic cancellation failure'});
    proposal={...proposal,status:'cancelled'};
    return reply(200,null);
   }
   case '/rest/v1/rpc/submit_business_page':{
    let raw='';
    for await(const chunk of request)raw+=chunk;
    if(reviewSubmissions||JSON.parse(raw).p_application!==draftApplication){
     return reply(400,{message:'Unexpected business page review submission'});
    }
    reviewSubmissions++;
    return reply(200,null);
   }
   case '/rest/v1/rpc/my_professional_onboarding_status':
    if(onboardingOutage){onboardingOutage=false;return reply(500,{message:'Synthetic onboarding outage'});}
    return reply(200,[]);
   case '/rest/v1/professional_applications':
    return reply(200,[{id:draftApplication,business_name:'Synthetic CCTV business',status:'submitted'}]);
   case '/rest/v1/professional_business_pages':
    if(request.method==='GET'&&initialBusinessOutage){initialBusinessOutage=false;return reply(500,{message:'Synthetic initial business page outage'});}
    if(request.method==='POST'){draftInserts++;return reply(201,null);}
    if(request.method==='PATCH'){draftUpdates++;return reply(204,null);}
    if(draftInserts)return reply(500,{message:'Synthetic draft read outage'});
    return reply(200,[]);
   default:return reply(200,[]);
  }
 });

 for(let attempt=0;;attempt++){
  try{await once(fixture.listen(54321,'127.0.0.1'),'listening');break;}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EADDRINUSE'||attempt>=80)throw error;
   await delay(250);
  }
 }
 try{
  const session={access_token:token,refresh_token:'synthetic-refresh',
   expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:professional};
  await page.context().addCookies([{name:'sb-127-auth-token',
   value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:app}]);
  await page.goto('/professional/apply');
  const retryOnboarding=page.getByRole('button',{name:'Retry loading onboarding'});
  await expect(retryOnboarding).toBeVisible();
  const applyHeading=page.getByRole('heading',{name:'Apply for a trade & service area'});
  await expect(applyHeading).toHaveCount(0);
  await retryOnboarding.press('Enter');
  await expect(applyHeading).toBeVisible();

  await page.goto('/quotes');
  await expect(page.getByRole('heading',{name:'Leads and quotes need to reload'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No matching open jobs'})).toHaveCount(0);
  await page.getByRole('button',{name:'Retry loading leads and quotes'}).press('Enter');
  await page.getByRole('button',{name:'Prepare a quote'}).click();
  await expect(page.getByRole('heading',{name:'Quote for: Synthetic CCTV installation'})).toBeFocused();
  await page.getByLabel('Your quote (£)').fill('225');
  await page.getByLabel('Earliest availability and timeframe (optional)').fill('Tuesday morning');
  await page.getByLabel('Message and scope of work').fill('Install the synthetic camera.');
  await page.getByRole('button',{name:'Send quote'}).click();
  const quoteError=page.getByText('Synthetic quote outage',{exact:true});
  await expect(quoteError).toBeFocused();
  await expect(page.getByLabel('Your quote (£)')).toHaveValue('225');
  await expect(page.getByLabel('Message and scope of work')).toHaveValue('Install the synthetic camera.');
  expect(writes).toBe(0);
  await page.getByRole('button',{name:'Send quote'}).press('Enter');
  await expect(page.getByText('Quote submitted to the customer.',{exact:false})).toBeVisible();
  const appointment=page.getByRole('link',{name:'Appointments'});
  await expect(appointment).toHaveAttribute('href','/schedule?booking='+bookingId);
  await appointment.click();
  await expect(page).toHaveURL(app+'/schedule?booking='+bookingId);
  const retry=page.getByRole('button',{name:'Retry loading appointments'});
  await expect(retry).toBeVisible();
  await expect(page.getByText('No bookings yet.',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Propose appointment'})).toHaveCount(0);
  await retry.press('Enter');
  await expect(page.getByRole('heading',{name:'Propose or change a time'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:/^Booking/})).toHaveValue(bookingId);
  const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  await page.getByLabel('Start date and time').fill(date+'T10:00');
  await page.getByLabel('End date and time').fill(date+'T11:00');
  await page.getByLabel('IANA time zone').fill('Europe/London');
  await page.getByRole('button',{name:'Propose appointment'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Synthetic proposal outage'})).toBeFocused();
  await expect(page.getByLabel('Start date and time')).toHaveValue(date+'T10:00');
  await expect(page.getByLabel('End date and time')).toHaveValue(date+'T11:00');
  await expect(page.getByLabel('IANA time zone')).toHaveValue('Europe/London');
  expect(proposal).toBeNull();
  await page.getByRole('button',{name:'Propose appointment'}).press('Enter');
  await expect(page.getByText('Appointment time proposed in Europe/London.',{exact:false})).toBeVisible();
  await expect(page.getByText('Appointment: proposed')).toBeVisible();
  const cancelTime=page.getByRole('button',{name:'Cancel appointment time'});
  await cancelTime.press('Enter');
  await expect(page.getByRole('button',{name:'Keep time'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cancelTime).toBeFocused();
  await cancelTime.press('Enter');
  await page.getByRole('button',{name:'Confirm cancellation'}).press('Enter');
  await expect(page.getByRole('alert').filter({hasText:'Synthetic cancellation failure'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Confirm cancellation'})).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(cancelTime).toBeFocused();
  await expect(page.getByText('Appointment: proposed')).toBeVisible();
  expect(writes).toBe(1);
  await cancelTime.press('Enter');
  await page.getByRole('button',{name:'Confirm cancellation'}).press('Enter');
  await expect(page.getByText('Appointment time cancelled; the booking itself remains active',{exact:false})).toBeFocused();
  await expect(page.getByText('Appointment: cancelled')).toBeVisible();
  expect(cancellationAttempts).toBe(2);

  await page.goto('/professional/business');
  const retryBusiness=page.getByRole('button',{name:'Retry loading business pages'});
  await expect(retryBusiness).toBeVisible();
  await expect(page.getByRole('link',{name:'Apply as a professional'})).toHaveCount(0);
  await retryBusiness.press('Enter');
  await page.getByLabel('My professional application').selectOption(draftApplication);
  await page.getByLabel('Public description').fill('Synthetic CCTV installation and maintenance services.');
  await page.getByRole('button',{name:'Save private draft'}).click();
  const saved=page.getByText('Draft saved privately. The business page list could not refresh.');
  await expect(saved).toBeVisible();
  await page.getByLabel('Public description').fill('Updated synthetic CCTV installation and maintenance services.');
  await page.getByRole('button',{name:'Save private draft'}).click();
  await expect(saved).toBeVisible();
  expect(draftInserts).toBe(1);
  expect(draftUpdates).toBe(1);
  await page.getByRole('button',{name:'Submit for review'}).press('Enter');
  await expect(page.getByText('Business page submitted for independent moderation. It is not public yet. The business page list could not refresh.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Submit for review'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'View public business page'})).toHaveCount(0);
  expect(reviewSubmissions).toBe(1);
 }finally{
  await new Promise<void>((resolve,reject)=>{
   fixture.close(error=>error?reject(error):resolve());
   fixture.closeAllConnections();
  });
 }
});
