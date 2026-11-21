import {expect,test} from '@playwright/test';

// Opt-in acceptance for an existing authorised staging customer session, paired
// with isolated deterministic fixture tests that run without real credentials.
// Never create fake approved professionals, mutate staging rows, or retain
// traces/screenshots/videos containing real account data.
const storageState=process.env.TRUSTFIVE_CUSTOMER_STORAGE_STATE;
const stagingAcceptanceEnabled=Boolean(
 storageState&&process.env.TRUSTFIVE_STAGING_ACCEPTANCE==='1'
);

test.use({trace:'off',screenshot:'off',video:'off'});

test.describe('isolated UK coverage fixture acceptance (no real credentials required)',()=>{
 const fourNationFixtures=[
  {
   query:'SW1A 1AA',
   expectedOutcode:'SW1A',
   suggestion:{
    label:'SW1A 1AA, Westminster, United Kingdom',
    latitude:51.50101,longitude:-0.141563,postcode:'SW1A 1AA',precision:'postcode',country:'GB',
   },
  },
  {
   query:'G1',
   expectedOutcode:'G1',
   suggestion:{
    label:'G1 postcode district, Glasgow City, United Kingdom',
    latitude:55.8588968,longitude:-4.2487832,postcode:null,precision:'postcode',country:'GB',
   },
  },
  {
   query:'CF10 1EP',
   expectedOutcode:'CF10',
   suggestion:{
    label:'CF10 1EP, Cardiff, United Kingdom',
    latitude:51.475764,longitude:-3.179217,postcode:'CF10 1EP',precision:'postcode',country:'GB',
   },
  },
  {
   query:'BT1 1AA',
   expectedOutcode:'BT1',
   suggestion:{
    label:'BT1 1AA, Belfast, United Kingdom',
    latitude:54.602438,longitude:-5.922291,postcode:'BT1 1AA',precision:'postcode',country:'GB',
   },
  },
 ];

 test('coverage page extracts postcode district across all four nations without implying approval or enabling anonymous submission',async({page})=>{
  await page.route('**/api/address/search',async route=>{
   const payload=route.request().postDataJSON() as {query?:string};
   const match=fourNationFixtures.find(item=>item.query===payload.query);
   await route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
     suggestions:match?[match.suggestion]:[],
     message:match?'Postcode-centre location (not a specific house)':'Not found',
    }),
   });
  });

  await page.goto('/coverage');
  const input=page.getByLabel('Your postcode or street address');

  for(const fixture of fourNationFixtures){
   await input.fill(fixture.query);
   const option=page.getByRole('option',{name:fixture.suggestion.label});
   await expect(option).toBeVisible();
   await option.click();
   await expect(page.getByRole('status').filter({hasText:'Area to register:'})).toContainText(fixture.expectedOutcode);
   await expect(page.getByText(/This is a request, not a verified operating boundary\./i)).toBeVisible();
   await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();
   expect(page.url()).not.toContain(fixture.expectedOutcode);
  }
 });

 test('coverage lookup degrades gracefully when upstream postcode service fails',async({page})=>{
  await page.route('**/api/address/search',async route=>{
   await route.fulfill({
    status:503,
    contentType:'application/json',
    body:JSON.stringify({suggestions:[],message:'Address lookup is temporarily unavailable'}),
   });
  });

  await page.goto('/coverage');
  await page.getByLabel('Your postcode or street address').fill('EH1 1YZ');
  await expect(page.getByText(/Address lookup is temporarily unavailable/i)).toBeVisible();
  await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();
  await expect(page.getByText(/Area to register:/i)).toHaveCount(0);
 });
});

test.describe('opt-in authorised staging coverage & negative access acceptance',()=>{
 test.skip(
  !stagingAcceptanceEnabled,
  'Requires TRUSTFIVE_STAGING_ACCEPTANCE=1 and TRUSTFIVE_CUSTOMER_STORAGE_STATE for an existing authorised staging account'
 );

 test('authorised customer can open /coverage read-only and is blocked from admin territory approval routes',async({browser,baseURL})=>{
  if(!storageState)throw new Error('Missing authorised customer storage state');
  const context=await browser.newContext({storageState,baseURL});
  try{
   const page=await context.newPage();
   await page.goto('/coverage');
   await expect(page.getByRole('heading',{name:/find or request trustfive coverage/i})).toBeVisible();
   await expect(page.getByRole('heading',{name:/your uk coverage requests/i})).toBeVisible();
   await expect(page.getByText(/Sign in before registering/i)).toHaveCount(0);
   await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();

   // Negative access assertion: a standard customer session must never gain
   // territory-approval controls on /admin/territories.
   await page.goto('/admin/territories');
   await expect(page.getByRole('button',{name:/save verified boundary|approve territory/i})).toHaveCount(0);
  }finally{
   await context.close();
  }
 });
});
