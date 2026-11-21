import {test,expect} from '@playwright/test';
import {parseJobBudgetPence} from '../../lib/job-budget';

test('Customer job budgets preserve exact pence and optional blank values',()=>{
 expect(parseJobBudgetPence('')).toBeNull();
 expect(parseJobBudgetPence('   ')).toBeNull();
 expect(parseJobBudgetPence('0')).toBe(0);
 expect(parseJobBudgetPence('12.3')).toBe(1230);
 expect(parseJobBudgetPence('12.34')).toBe(1234);
 expect(parseJobBudgetPence(' 10000000.00 ')).toBe(1_000_000_000);
 expect(parseJobBudgetPence('0000001.01')).toBe(101);
});

test('Customer job budgets reject exponent, sign, excess precision and overflow',()=>{
 for(const invalid of ['1e3','-1','+1','0.001','12.345','£20','1,000','1.','0x10','Infinity','NaN','10000000.01','9999999999999999999999999999999']){
  expect(()=>parseJobBudgetPence(invalid),invalid).toThrow();
 }
});
