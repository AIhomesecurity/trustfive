import {test,expect} from '@playwright/test';
import {
 gbpToPence,
 normaliseQuoteText,
 validateProfessionalQuote
} from '../../lib/professional-quote-validation';

const scope='Supply and fit replacement kitchen units, including removal of the old units and disposal.';
const valid=(overrides:{amount?:string;message?:string}={})=>({amount:'450.00',message:scope,...overrides});

test('Valid GBP amounts convert to exact integer pence including boundaries',()=>{
 for(const [amount,pence] of [
  ['1.00',100],['1',100],['1.5',150],['450.00',45000],
  ['10000000.00',1000000000],[' 275.50 ',27550]
 ] as const){
  expect(gbpToPence(amount)).toBe(pence);
 }
});

test('Empty, malformed, negative, zero and excessive prices are rejected',()=>{
 for(const amount of ['','   ','abc','-1','0','0.99','10000000.01','1e3','£100.00','1,000.00']){
  const result=validateProfessionalQuote(valid({amount}));
  expect(result).toMatchObject({ok:false,field:'amount'});
 }
});

test('More than two decimal places are rejected without rounding',()=>{
 for(const amount of ['1.001','1.005','1.009','12.345','0.999']){
  expect(gbpToPence(amount)).toBeNull();
  const result=validateProfessionalQuote(valid({amount}));
  expect(result).toMatchObject({ok:false,field:'amount'});
 }
});

test('Conversion avoids floating-point rounding errors',()=>{
 expect(gbpToPence('0.29')).toBe(29);
 expect(gbpToPence('10.10')).toBe(1010);
 expect(gbpToPence('1234567.89')).toBe(123456789);
 expect(gbpToPence('9999999.99')).toBe(999999999);
});

test('Scope description length is enforced after whitespace normalisation',()=>{
 const padded='  '+scope.replace(/ /g,'   ')+'  ';
 expect(normaliseQuoteText(padded)).toBe(scope);
 expect(validateProfessionalQuote(valid({message:padded})).ok).toBe(true);
 const short=validateProfessionalQuote(valid({message:'a'.repeat(9)}));
 expect(short).toMatchObject({ok:false,field:'message'});
 expect(validateProfessionalQuote(valid({message:'a'.repeat(10)})).ok).toBe(true);
 expect(validateProfessionalQuote(valid({message:'a'.repeat(3000)})).ok).toBe(true);
 const long=validateProfessionalQuote(valid({message:'a'.repeat(3001)}));
 expect(long).toMatchObject({ok:false,field:'message'});
});

test('Missing and whitespace-only scope descriptions are rejected',()=>{
 for(const message of ['','   ','\n\t\n']){
  const result=validateProfessionalQuote(valid({message}));
  expect(result).toMatchObject({ok:false,field:'message'});
 }
});

test('A valid quote returns normalised text and integer pence for submission',()=>{
 const result=validateProfessionalQuote({
  amount:' 120.75 ',
  message:'  Supply and fit\nreplacement   kitchen units, including removal and disposal.  '
 });
 expect(result.ok).toBe(true);
 if(result.ok){
  expect(result.amountPence).toBe(12075);
  expect(result.message).toBe('Supply and fit replacement kitchen units, including removal and disposal.');
  expect(Number.isInteger(result.amountPence)).toBe(true);
 }
});

test('Field errors are actionable and expose no internal detail',()=>{
 const results=[
  validateProfessionalQuote(valid({amount:''})),
  validateProfessionalQuote(valid({amount:'1.234'})),
  validateProfessionalQuote(valid({message:'short'}))
 ];
 for(const result of results){
  expect(result.ok).toBe(false);
  if(result.ok)continue;
  expect(['amount','message']).toContain(result.field);
  expect(result.message.length).toBeGreaterThan(10);
  expect(result.message).not.toMatch(/undefined|NaN|Error|null/i);
 }
});

test('Amount and message are validated independently',()=>{
 const badAmount=validateProfessionalQuote(valid({amount:'0',message:'short'}));
 expect(badAmount).toMatchObject({ok:false,field:'amount'});
 const badMessage=validateProfessionalQuote(valid({amount:'450.00',message:'short'}));
 expect(badMessage).toMatchObject({ok:false,field:'message'});
});
