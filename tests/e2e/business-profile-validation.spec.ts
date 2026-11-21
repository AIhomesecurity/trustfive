import {test,expect} from '@playwright/test';
import {
 normaliseProfileText,
 validateBusinessProfile,
 type BusinessProfileInput
} from '../../lib/business-profile-validation';

const description='We provide reliable, insured electrical installation and maintenance services for homes and small businesses across Bristol and Bath.';
const valid=(overrides:Partial<BusinessProfileInput>={}):BusinessProfileInput=>({
 name:'Bristol Bright Electrical',
 description,
 website:'',
 phone:'',
 ...overrides
});

test('A fully valid draft returns normalised values and null optional fields',()=>{
 const result=validateBusinessProfile(valid({
  name:'  Bristol   Bright  Electrical ',
  description:'  '+description+'  ',
  phone:'  0117  123 4567  '
 }));
 expect(result.ok).toBe(true);
 if(result.ok){
  expect(result.values).toEqual({
   displayName:'Bristol Bright Electrical',
   description,
   websiteUrl:null,
   publicPhone:'0117 123 4567'
  });
 }
});

test('Business name enforces 2-120 meaningful characters',()=>{
 for(const name of ['','   ','a','a'.repeat(121)]){
  const result=validateBusinessProfile(valid({name}));
  expect(result).toMatchObject({ok:false,field:'name'});
 }
 expect(validateBusinessProfile(valid({name:'ab'})).ok).toBe(true);
 expect(validateBusinessProfile(valid({name:'a'.repeat(120)})).ok).toBe(true);
});

test('Public description enforces 30-4000 meaningful characters',()=>{
 expect(validateBusinessProfile(valid({description:'a'.repeat(29)}))).toMatchObject({ok:false,field:'description'});
 expect(validateBusinessProfile(valid({description:'a'.repeat(30)})).ok).toBe(true);
 expect(validateBusinessProfile(valid({description:'a'.repeat(4000)})).ok).toBe(true);
 expect(validateBusinessProfile(valid({description:'a'.repeat(4001)}))).toMatchObject({ok:false,field:'description'});
});

test('Valid public HTTPS URLs are accepted',()=>{
 for(const website of ['https://example.co.uk','https://www.example.com/path?q=1','HTTPS://example.com']){
  const result=validateBusinessProfile(valid({website}));
  expect(result.ok).toBe(true);
  if(result.ok)expect(result.values.websiteUrl).toBe(website);
 }
});

test('Unsafe schemes and credential-bearing or private URLs are rejected',()=>{
 const bad=[
  'http://example.com','ftp://example.com','javascript:alert(1)','data:text/html,x','//example.com',
  'https://user:pass@example.com','https://localhost','https://127.0.0.1','https://192.168.1.1',
  'https://10.0.0.5','https://[::1]','https://business.local','https://example'
 ];
 for(const website of bad){
  const result=validateBusinessProfile(valid({website}));
  expect(result).toMatchObject({ok:false,field:'website'});
 }
});

test('Reasonable phone numbers are accepted and malformed ones rejected',()=>{
 for(const phone of ['0117 123 4567','+44 (0)117 1234567','020-7946-0958','07123456789']){
  expect(validateBusinessProfile(valid({phone})).ok).toBe(true);
 }
 for(const phone of ['123','abcdefghij','0117 123 456789012345678901234567890','+44 (0)117 ext 9']){
  const result=validateBusinessProfile(valid({phone}));
  expect(result).toMatchObject({ok:false,field:'phone'});
 }
});

test('normaliseProfileText collapses whitespace without changing meaningful content',()=>{
 expect(normaliseProfileText('  Electrical   installations\n for  homes  ')).toBe('Electrical installations for homes');
 expect(normaliseProfileText('Mr   &  Mrs  Smith').replace(/\s+/g,' ')).toContain('&');
});

test('Each field is validated independently',()=>{
 expect(validateBusinessProfile(valid({name:'a',description:'short'}))).toMatchObject({ok:false,field:'name'});
 expect(validateBusinessProfile(valid({description:'short',website:'http://example.com'}))).toMatchObject({ok:false,field:'description'});
 expect(validateBusinessProfile(valid({website:'http://example.com',phone:'123'}))).toMatchObject({ok:false,field:'website'});
});

test('Error messages are actionable and expose no internal detail',()=>{
 const results=[
  validateBusinessProfile(valid({name:'a'})),
  validateBusinessProfile(valid({description:'short'})),
  validateBusinessProfile(valid({website:'http://example.com'})),
  validateBusinessProfile(valid({phone:'abc'}))
 ];
 for(const result of results){
  expect(result.ok).toBe(false);
  if(result.ok)continue;
  expect(['name','description','website','phone']).toContain(result.field);
  expect(result.message.length).toBeGreaterThan(10);
  expect(result.message).not.toMatch(/undefined|NaN|Error|null/i);
 }
});
