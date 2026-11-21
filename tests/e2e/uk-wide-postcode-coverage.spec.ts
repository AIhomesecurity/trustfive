import {test,expect} from '@playwright/test';
import {ukPostcodeLookupKind,ukPostcodeLookupPath,ukPostcodeSuggestion}
 from '../../lib/uk-postcode-lookup';
import {jobAddressLabel} from '../../lib/job-address';

test('Nationwide postcode lookup recognises full postcodes and outward codes',()=>{
 const examples:[
  string,'full'|'outcode'
 ][]=[
  ['SW1A 1AA','full'],['CF10 1EP','full'],['EH1 1YZ','full'],
  ['BT1 1AA','full'],['G1','outcode'],['BT1','outcode'],
  ['CF10','outcode'],['SW1A','outcode'],['AB12','outcode']
 ];
 for(const [value,kind] of examples){
  expect(ukPostcodeLookupKind(value)).toBe(kind);
  expect(ukPostcodeLookupPath(value)?.startsWith(kind==='full'?'/postcodes/':'/outcodes/')).toBe(true);
 }
 expect(ukPostcodeLookupKind('')).toBeNull();
 expect(ukPostcodeLookupKind('London')).toBeNull();
 expect(ukPostcodeLookupKind('123 Invalid Road')).toBeNull();
 expect(ukPostcodeLookupKind('SW1A 1AA/../admin')).toBeNull();
});

test('UK provider results cover four nations without confusing district with home address',()=>{
 const countryCodes=['England','Wales','Scotland','Northern Ireland'];
 for(const country of countryCodes){
  const suggestion=ukPostcodeSuggestion({
   postcode:'BT1 1AA',country,latitude:54.596,longitude:-5.930,
   admin_district:'Belfast'
  },'full');
  expect(suggestion?.country).toBe('GB');
  expect(suggestion?.precision).toBe('postcode');
  expect(suggestion?.postcode).toBe('BT1 1AA');
 }
 const district=ukPostcodeSuggestion({
  outcode:'BT1',country:['Northern Ireland'],admin_district:['Belfast'],
  latitude:54.595,longitude:-5.93
 },'outcode');
 expect(district).toEqual({
  label:'BT1 postcode district, Belfast, United Kingdom',
  latitude:54.595,longitude:-5.93,postcode:null,precision:'postcode',country:'GB'
 });
 expect(()=>jobAddressLabel(district!,'14 High Street')).toThrow(/full UK postcode/);
 expect(ukPostcodeSuggestion({postcode:'GY1 1AA',country:'Channel Islands',latitude:49.5,longitude:-2.55},'full')).toBeNull();
 expect(ukPostcodeSuggestion({outcode:'IM1',country:['Isle of Man'],latitude:54.15,longitude:-4.48},'outcode')).toBeNull();
 expect(ukPostcodeSuggestion({outcode:'BT1',country:['Northern Ireland'],latitude:NaN,longitude:0},'outcode')).toBeNull();
});

test('Directory supports short UK districts without promising an exact property',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  const input=route.request().postDataJSON() as {query:string};
  expect(input.query).toBe('BT1');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[{label:'BT1 postcode district, Belfast, United Kingdom',
    latitude:54.595,longitude:-5.93,postcode:null,precision:'postcode',country:'GB'}]
  })});
 });
 await page.goto('/services');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('BT1');
 await expect(page.getByRole('option',{name:/BT1 postcode district/})).toBeVisible();
 await page.getByRole('option',{name:/BT1 postcode district/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('Belfast');
 await expect(page.getByText(/approximate postcode or district centre/i)).toBeVisible();
 expect(page.url()).not.toContain('BT1');
});
