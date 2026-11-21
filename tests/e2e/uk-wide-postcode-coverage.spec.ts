import {test,expect} from '@playwright/test';
import {
 ukOutcodeFromInput,
 ukPostcodeLookupKind,
 ukPostcodeLookupPath,
 ukPostcodeSuggestion,
} from '../../lib/uk-postcode-lookup';
import {jobAddressLabel} from '../../lib/job-address';

test('Nationwide postcode lookup recognises full postcodes and outward codes',()=>{
 const examples:[
  string,'full'|'outcode'
 ][]=[
  ['SW1A 1AA','full'],['CF10 1EP','full'],['EH1 1YZ','full'],
  ['BT1 1AA','full'],['SW1A1AA','full'],['G1','outcode'],
  ['BT1','outcode'],['CF10','outcode'],['SW1A','outcode'],
  ['AB12','outcode'],['CH4','outcode']
 ];
 for(const [value,kind] of examples){
  expect(ukPostcodeLookupKind(value)).toBe(kind);
  expect(ukPostcodeLookupPath(value)?.startsWith(kind==='full'?'/postcodes/':'/outcodes/')).toBe(true);
 }
 expect(ukPostcodeLookupKind('')).toBeNull();
 expect(ukPostcodeLookupKind('London')).toBeNull();
 expect(ukPostcodeLookupKind('123 Invalid Road')).toBeNull();
 expect(ukPostcodeLookupKind('SW1A 1AA/../admin')).toBeNull();

 // DB-valid outward code extraction (matching ^[A-Z]{1,2}[0-9][A-Z0-9]?$)
 expect(ukOutcodeFromInput('SW1A 1AA')).toBe('SW1A');
 expect(ukOutcodeFromInput('sw1a1aa')).toBe('SW1A');
 expect(ukOutcodeFromInput('BT1 postcode district, Belfast, United Kingdom')).toBe('BT1');
 expect(ukOutcodeFromInput('CH4')).toBe('CH4');
 expect(ukOutcodeFromInput('GIR 0AA')).toBeNull();
 expect(ukOutcodeFromInput('London')).toBeNull();
});

test('UK provider results match empirical four-nation postcodes.io response shapes without faking street addresses',()=>{
 // Real postcodes.io full-postcode shapes across England, Scotland, Wales, Northern Ireland
 const fullPayloads=[
  {
   raw:{postcode:'SW1A 1AA',country:'England',admin_district:'Westminster',parish:'Westminster, unparished area',latitude:51.50101,longitude:-0.141563},
   expectedLabel:'SW1A 1AA, Westminster, United Kingdom',
   expectedPostcode:'SW1A 1AA',
  },
  {
   raw:{postcode:'EH1 1YZ',country:'Scotland',admin_district:'City of Edinburgh',parish:null,latitude:55.950328,longitude:-3.193018},
   expectedLabel:'EH1 1YZ, City of Edinburgh, United Kingdom',
   expectedPostcode:'EH1 1YZ',
  },
  {
   raw:{postcode:'CF10 1EP',country:'Wales',admin_district:'Cardiff',parish:'Castle',latitude:51.475764,longitude:-3.179217},
   expectedLabel:'CF10 1EP, Cardiff, United Kingdom',
   expectedPostcode:'CF10 1EP',
  },
  {
   raw:{postcode:'BT1 1AA',country:'Northern Ireland',admin_district:'Belfast',parish:null,latitude:54.602438,longitude:-5.922291},
   expectedLabel:'BT1 1AA, Belfast, United Kingdom',
   expectedPostcode:'BT1 1AA',
  },
 ];
 for(const item of fullPayloads){
  const suggestion=ukPostcodeSuggestion(item.raw,'full');
  expect(suggestion).not.toBeNull();
  expect(suggestion?.country).toBe('GB');
  expect(suggestion?.precision).toBe('postcode');
  expect(suggestion?.postcode).toBe(item.expectedPostcode);
  expect(suggestion?.label).toBe(item.expectedLabel);
 }

 // Spaceless full postcode normalises cleanly
 const compactFull=ukPostcodeSuggestion({
  postcode:'sw1a1aa',country:'England',admin_district:'Westminster',latitude:51.50101,longitude:-0.141563
 },'full');
 expect(compactFull?.postcode).toBe('SW1A 1AA');

 // Real postcodes.io outcode shapes including Scotland/NI empty parishes and England/Wales cross-border CH4
 const belfastDistrict=ukPostcodeSuggestion({
  outcode:'BT1',country:['Northern Ireland'],admin_district:['Belfast'],parish:[],
  latitude:54.5997798,longitude:-5.9285097
 },'outcode');
 expect(belfastDistrict).toEqual({
  label:'BT1 postcode district, Belfast, United Kingdom',
  latitude:54.5997798,longitude:-5.9285097,postcode:null,precision:'postcode',country:'GB'
 });
 expect(()=>jobAddressLabel(belfastDistrict!,'14 High Street')).toThrow(/full UK postcode/);

 const crossBorder=ukPostcodeSuggestion({
  outcode:'CH4',country:['England','Wales'],admin_district:['   ','Cheshire West and Chester','Flintshire'],
  latitude:53.1654657,longitude:-2.9471306
 },'outcode');
 expect(crossBorder).toEqual({
  label:'CH4 postcode district, Cheshire West and Chester, United Kingdom',
  latitude:53.1654657,longitude:-2.9471306,postcode:null,precision:'postcode',country:'GB'
 });

 // Reject Crown Dependencies, mixed non-UK country arrays, Null Island, out-of-UK coordinates and malformed payloads
 expect(ukPostcodeSuggestion({postcode:'GY1 1AA',country:'Channel Islands',latitude:49.45,longitude:-2.55},'full')).toBeNull();
 expect(ukPostcodeSuggestion({outcode:'IM1',country:['Isle of Man'],latitude:54.15,longitude:-4.48},'outcode')).toBeNull();
 expect(ukPostcodeSuggestion({outcode:'CH4',country:['England','Isle of Man'],latitude:53.16,longitude:-2.94},'outcode')).toBeNull();
 expect(ukPostcodeSuggestion({postcode:'SW1A 1AA',country:'England',latitude:0,longitude:0},'full')).toBeNull();
 expect(ukPostcodeSuggestion({postcode:'SW1A 1AA',country:'England',latitude:40.7128,longitude:-74.006},'full')).toBeNull();
 expect(ukPostcodeSuggestion({outcode:'BT1',country:['Northern Ireland'],latitude:NaN,longitude:-5.93},'outcode')).toBeNull();
 expect(ukPostcodeSuggestion(null,'full')).toBeNull();
 expect(ukPostcodeSuggestion({postcode:'SW1A 1AA',country:null,latitude:51.5,longitude:-0.14},'full')).toBeNull();
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
