import {test,expect} from '@playwright/test';
import {jobAddressLabel} from '../../lib/job-address';
import type {SelectedLocation} from '../../components/address-search';

const location:SelectedLocation={
 label:'  14 High Street\n  Exampletown   AB1 2CD  ',
 latitude:51.5,longitude:-0.12,postcode:'AB1 2CD',precision:'address',country:'GB'
};

test('normalizes provider whitespace in private property addresses',()=>{
 expect(jobAddressLabel(location,'')).toBe('14 High Street Exampletown AB1 2CD');
});

test('postcode-centre address retains the separately supplied premises',()=>{
 expect(jobAddressLabel({...location,precision:'postcode',label:' Exampletown\n AB1 2CD '},'  14   High Street ')).toBe('14 High Street, Exampletown AB1 2CD');
});

test('rejects missing or oversized provider addresses',()=>{
 expect(()=>jobAddressLabel({...location,label:' \n '},'')).toThrow();
 expect(()=>jobAddressLabel({...location,label:'x'.repeat(251)},'')).toThrow();
});

test('postcode-only suggestions require meaningful property details',()=>{
 expect(()=>jobAddressLabel({...location,precision:'postcode'},'   ')).toThrow();
});
