import {test,expect} from '@playwright/test';
import {
 normaliseText,
 validateProfessionalApplication,
 type ProfessionalApplicationInput
} from '../../lib/professional-application-validation';

const tradeIds=['trade-electrician','trade-plumber'];
const areaIds=['area-bristol','area-bath'];
const validAbout='I install and maintain electrical systems for homes and small businesses across Bristol and Bath. Fully qualified and insured.';
const valid=(overrides:Partial<ProfessionalApplicationInput>={}):ProfessionalApplicationInput=>({
 businessName:'Bristol Bright Electrical',
 experienceYears:'12',
 about:validAbout,
 tradeId:'trade-electrician',
 areaId:'area-bristol',
 tradeIds,
 areaIds,
 ...overrides
});

test('Valid application is accepted with normalised values',()=>{
 const result=validateProfessionalApplication(valid({
  businessName:'  Bristol   Bright\tElectrical  ',
  about:`  I install and maintain electrical systems\nfor homes   and small businesses across Bristol and Bath. Fully qualified and insured.  `
 }));
 expect(result.ok).toBe(true);
 if(result.ok){
  expect(result.values.businessName).toBe('Bristol Bright Electrical');
  expect(result.values.experienceYears).toBe(12);
  expect(result.values.about).toBe(normaliseText(validAbout));
  expect(result.values.tradeId).toBe('trade-electrician');
  expect(result.values.areaId).toBe('area-bristol');
 }
});

test('Business name rejects missing, whitespace-only, too short and too long values',()=>{
 for(const businessName of ['','   ','a','   a   ','a'.repeat(121)]){
  expect(validateProfessionalApplication(valid({businessName}))).toMatchObject({ok:false,field:'businessName'});
 }
 expect(validateProfessionalApplication(valid({businessName:'ab'})).ok).toBe(true);
 expect(validateProfessionalApplication(valid({businessName:'a'.repeat(120)})).ok).toBe(true);
});

test('Experience must be a whole number between 0 and 80',()=>{
 for(const experienceYears of ['','abc','3.5','-1','81','1e2']){
  expect(validateProfessionalApplication(valid({experienceYears}))).toMatchObject({ok:false,field:'experienceYears'});
 }
 expect(validateProfessionalApplication(valid({experienceYears:'0'})).ok).toBe(true);
 expect(validateProfessionalApplication(valid({experienceYears:'80'})).ok).toBe(true);
 expect(validateProfessionalApplication(valid({experienceYears:5})).ok).toBe(true);
});

test('Description must contain 30-3000 meaningful characters',()=>{
 expect(validateProfessionalApplication(valid({about:'a'.repeat(29)}))).toMatchObject({ok:false,field:'about'});
 expect(validateProfessionalApplication(valid({about:'a'.repeat(3001)}))).toMatchObject({ok:false,field:'about'});
 expect(validateProfessionalApplication(valid({about:'a'.repeat(30)})).ok).toBe(true);
 expect(validateProfessionalApplication(valid({about:'a'.repeat(3000)})).ok).toBe(true);
});

test('Trade and service area must be selected from the loaded options',()=>{
 expect(validateProfessionalApplication(valid({tradeId:''}))).toMatchObject({ok:false,field:'tradeId'});
 expect(validateProfessionalApplication(valid({tradeId:'trade-carpenter'}))).toMatchObject({ok:false,field:'tradeId'});
 expect(validateProfessionalApplication(valid({areaId:''}))).toMatchObject({ok:false,field:'areaId'});
 expect(validateProfessionalApplication(valid({areaId:'area-cardiff'}))).toMatchObject({ok:false,field:'areaId'});
});

test('normaliseText collapses all whitespace runs',()=>{
 expect(normaliseText('  a\t b\r\n c   d  ')).toBe('a b c d');
 expect(normaliseText('a\u00a0\u00a0b')).toBe('a b');
});

test('Validation messages are actionable and leak no internal detail',()=>{
 const results=[
  validateProfessionalApplication(valid({businessName:'a'})),
  validateProfessionalApplication(valid({experienceYears:'3.5'})),
  validateProfessionalApplication(valid({about:'short'})),
  validateProfessionalApplication(valid({tradeId:'unknown'})),
  validateProfessionalApplication(valid({areaId:'unknown'}))
 ];
 for(const result of results){
  expect(result.ok).toBe(false);
  if(result.ok)continue;
  expect(result.message.length).toBeGreaterThan(10);
  expect(result.message).not.toMatch(/undefined|NaN|Error|null/i);
 }
});
