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
test('signed-in professional retries eligible leads, submits a quote and opens the booked appointment',async({page})=>{
 test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL!==backend,'Requires the isolated loopback application build.');
 test.setTimeout(60000);
 page.setDefaultTimeout(10000);
 let leadOutage=true;
 let writes=0;
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
  await expect(page.getByText('Quote submitted to the customer.',{exact:false})).toBeVisible();
  const appointment=page.getByRole('link',{name:'Appointments'});
  await expect(appointment).toHaveAttribute('href','/schedule?booking='+bookingId);
  await appointment.click();
  await expect(page).toHaveURL(app+'/schedule?booking='+bookingId);
  await expect(page.getByRole('heading',{name:'Propose or change a time'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:/^Booking/})).toHaveValue(bookingId);
  expect(writes).toBe(1);
 }finally{
  await new Promise<void>((resolve,reject)=>{
   fixture.close(error=>error?reject(error):resolve());
   fixture.closeAllConnections();
  });
 }
});
