import {test,expect} from '@playwright/test';
import {jobAddressLabel} from '../../lib/job-address';
import type {SelectedLocation} from '../../components/address-search';

const postcodeSite:SelectedLocation={
 label:'SW1A 1AA, London',latitude:51.501,longitude:-0.141,
 postcode:'SW1A 1AA',precision:'postcode',country:'GB'
};

test('postcode-only property details reject punctuation and whitespace padding',()=>{
 expect(()=>jobAddressLabel(postcodeSite,' --- !!! ')).toThrow(/house number\/name and street/);
 expect(()=>jobAddressLabel(postcodeSite,' 1--- ')).toThrow(/house number\/name and street/);
});

test('postcode-only property details preserve ordinary premises and normalized whitespace',()=>{
 expect(jobAddressLabel(postcodeSite,' 14   High\nStreet ')).toBe('14 High Street, SW1A 1AA, London');
});

test('exact provider address does not require manual property details',()=>{
 expect(jobAddressLabel({...postcodeSite,precision:'address',label:' 14   High Street '},'')).toBe('14 High Street');
});
