import {test,expect} from '@playwright/test';
import {
 normaliseAccountText,
 validateAccountProfile
} from '../../lib/account-profile-validation';

const valid=(overrides:{fullName?:string;phone?:string}={})=>({
 fullName:'Alex Morgan',
 phone:'0117 123 4567',
 ...overrides
});

test('Valid UK and international phone numbers are accepted',()=>{
 for(const phone of ['0117 123 4567','07700 900123','+44 20 7946 0958','+1 (415) 555-2671','020.7946.0958']){
  expect(validateAccountProfile(valid({phone})).ok).toBe(true);
 }
});

test('Full name enforces 2-150 meaningful characters',()=>{
 for(const fullName of ['','   ','a','a'.repeat(151)]){
  const result=validateAccountProfile(valid({fullName}));
  expect(result).toMatchObject({ok:false,field:'fullName'});
 }
 expect(validateAccountProfile(valid({fullName:'ab'})).ok).toBe(true);
 expect(validateAccountProfile(valid({fullName:'a'.repeat(150)})).ok).toBe(true);
});

test('Malformed phone numbers are rejected',()=>{
 for(const phone of ['123456','abcdefghij','0117 123 456789012345678901234567890','+44 (0)117 ext 9','call me']){
  const result=validateAccountProfile(valid({phone}));
  expect(result).toMatchObject({ok:false,field:'phone'});
 }
});

test('Blank and whitespace-only values are rejected for both fields',()=>{
 expect(validateAccountProfile(valid({fullName:'   ',phone:'\n\t' }))).toMatchObject({ok:false,field:'fullName'});
 expect(validateAccountProfile(valid({fullName:'Alex Morgan',phone:'   '}))).toMatchObject({ok:false,field:'phone'});
});

test('Legitimate names keep their case, punctuation and single spaces',()=>{
 expect(normaliseAccountText("  Mary-Jane   O'Connor  ")).toBe("Mary-Jane O'Connor");
 expect(validateAccountProfile(valid({fullName:"  Mary-Jane   O'Connor  "})).ok).toBe(true);
 const result=validateAccountProfile(valid({fullName:"  Dr   A.  Patel "}));
 expect(result.ok).toBe(true);
 if(result.ok)expect(result.values.fullName).toBe('Dr A. Patel');
});

test('A valid profile returns trimmed, normalised values only',()=>{
 const result=validateAccountProfile({
  fullName:'  Alex   Morgan ',
  phone:'  +44  20  7946 0958  '
 });
 expect(result.ok).toBe(true);
 if(result.ok)expect(result.values).toEqual({fullName:'Alex Morgan',phone:'+44 20 7946 0958'});
});

test('Each field is validated independently',()=>{
 expect(validateAccountProfile(valid({fullName:'a',phone:'abc'}))).toMatchObject({ok:false,field:'fullName'});
 expect(validateAccountProfile(valid({fullName:'Alex Morgan',phone:'abc'}))).toMatchObject({ok:false,field:'phone'});
});

test('Error messages are actionable and expose no internal detail',()=>{
 const results=[
  validateAccountProfile(valid({fullName:'a'})),
  validateAccountProfile(valid({phone:'abc'}))
 ];
 for(const result of results){
  expect(result.ok).toBe(false);
  if(result.ok)continue;
  expect(['fullName','phone']).toContain(result.field);
  expect(result.message.length).toBeGreaterThan(10);
  expect(result.message).not.toMatch(/undefined|NaN|Error|null/i);
 }
});

test('Phone normalisation collapses whitespace without dropping digits',()=>{
 expect(normaliseAccountText('+44   117   123 4567')).toBe('+44 117 123 4567');
 expect(validateAccountProfile(valid({phone:'+44   117   123 4567'})).ok).toBe(true);
});
