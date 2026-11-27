import {test,expect} from '@playwright/test';
import {canPrepareProfessionalQuote} from '../../lib/professional-quote-guard';

const lead={job_id:'job-1',allocation_id:'allocation-1'};
test('permits one unquoted matching allocation',()=>{
 expect(canPrepareProfessionalQuote(lead,[lead],[])).toBe(true);
});
test('rejects duplicate identical lead rows',()=>{
 expect(canPrepareProfessionalQuote(lead,[lead,{...lead}],[])).toBe(false);
});
test('rejects contradictory allocations for one job',()=>{
 expect(canPrepareProfessionalQuote(lead,[lead,{...lead,allocation_id:'allocation-2'}],[])).toBe(false);
});
test('rejects stale selection and already quoted jobs',()=>{
 expect(canPrepareProfessionalQuote(lead,[{...lead,allocation_id:'allocation-2'}],[])).toBe(false);
 expect(canPrepareProfessionalQuote(lead,[lead],[{job_id:'job-1',status:'pending'}])).toBe(false);
});
test('rejects missing identifiers and accepts independent other jobs',()=>{
 expect(canPrepareProfessionalQuote({...lead,job_id:''},[lead],[])).toBe(false);
 expect(canPrepareProfessionalQuote({...lead,allocation_id:''},[lead],[])).toBe(false);
 expect(canPrepareProfessionalQuote(lead,[lead,{job_id:'job-2',allocation_id:'allocation-2'}],[])).toBe(true);
});
