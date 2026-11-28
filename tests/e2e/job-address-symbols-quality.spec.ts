import {test,expect} from '@playwright/test';
import {jobAddressLabel} from '../../lib/job-address';
import type {SelectedLocation} from '../../components/address-search';

const postcode:SelectedLocation={
 label:'SW1A 1AA, London',latitude:51.501,longitude:-0.141,
 postcode:'SW1A 1AA',precision:'postcode',country:'GB'
};

test('Postcode property line rejects symbols-only and number-with-padding inputs',()=>{
 for(const property of [' --- !!! ',' 1--- ','   _ / -  ',' 1---\n ']){
  expect(()=>jobAddressLabel(postcode,property)).toThrow(/house number\/name and street/);
 }
});

test('Postcode property line accepts plausible alphanumeric house and street text',()=>{
 expect(jobAddressLabel(postcode,'14 High Street')).toBe('14 High Street, SW1A 1AA, London');
 expect(jobAddressLabel(postcode,'Flat 2B, High Street')).toBe('Flat 2B, High Street, SW1A 1AA, London');
});
