import {test,expect} from '@playwright/test';

// Public address search must fail closed before calling any paid or external provider.
// These cases run against the real Next.js route with no live customer addresses.
test('Address search rejects malformed payloads and non-string values',async({request})=>{
 const invalid=[
  {name:'missing query',body:{}},
  {name:'null query',body:{query:null}},
  {name:'numeric query',body:{query:123456}},
  {name:'array query',body:{query:['SW1A 1AA']}},
  {name:'object query',body:{query:{postcode:'SW1A 1AA'}}},
  {name:'overlong query',body:{query:'a'.repeat(161)}},
  {name:'whitespace query',body:{query:'   '}},
  {name:'short query',body:{query:'AB'}}
 ];
 for(const item of invalid){
  const response=await request.post('/api/address/search',{data:item.body});
  expect(response.status(),item.name).toBe(400);
  expect(response.headers()['cache-control'],item.name).toContain('no-store');
  const json=await response.json() as {suggestions:unknown;message:unknown};
  expect(json.suggestions,item.name).toEqual([]);
  expect(typeof json.message,item.name).toBe('string');
  expect(JSON.stringify(json),item.name).not.toContain('apiKey');
 }
 const malformed=await request.post('/api/address/search',{
  data:'{broken json',headers:{'Content-Type':'application/json'}
 });
 expect(malformed.status()).toBe(400);
 expect((await malformed.json()).suggestions).toEqual([]);
});

test('Address search never exposes a secret or private provider response on bad input',async({request})=>{
 const response=await request.post('/api/address/search',{data:{query:'a'.repeat(161)}});
 const text=await response.text();
 expect(response.status()).toBe(400);
 expect(text).not.toMatch(/GEOAPIFY_API_KEY|SUPABASE_SERVICE_ROLE|sb_secret_|Bearer\s+/i);
 expect(text).not.toMatch(/latitude|longitude|street_address/i);
});

test('Address search has no read-only GET endpoint that can leak address query parameters',async({request})=>{
 const response=await request.get('/api/address/search?query=SW1A%201AA');
 expect(response.status()).toBe(405);
 expect((await response.text())).not.toContain('SW1A 1AA');
});
