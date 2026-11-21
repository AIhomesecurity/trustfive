import {expect,test} from '@playwright/test';
import {jobPublishBlocker,type PublishReadiness} from '../../lib/job-publish-readiness';
import type {SelectedLocation} from '../../components/address-search';

const site:SelectedLocation={label:'10 Example Road, London',latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',precision:'address',country:'GB'};
function ready():PublishReadiness{return {title:'Repair leaking tap',description:'Kitchen tap is leaking underneath the sink',trade:'trade-id',site,checkedSite:site,manualProperty:'',area:'area-id',budget:'250.50',busy:false,territoryChecking:false,territoryVerified:true,manualFallbackAllowed:false};}

test('publish is enabled only after current address is verified',()=>{
 expect(jobPublishBlocker(ready())).toBe('');
 const changed={...site,label:'12 Example Road'};
 expect(jobPublishBlocker({...ready(),site:changed})).toContain('Wait for this address');
 expect(jobPublishBlocker({...ready(),territoryChecking:true})).toContain('Wait for this address');
 expect(jobPublishBlocker({...ready(),territoryVerified:false})).toContain('cannot be published');
});

test('rejects blank trade, area, and non-substantive text',()=>{
 expect(jobPublishBlocker({...ready(),trade:''})).toContain('Choose a trade');
 expect(jobPublishBlocker({...ready(),area:''})).toContain('Choose a service territory');
 expect(jobPublishBlocker({...ready(),title:'  !!  '})).toContain('meaningful characters');
 expect(jobPublishBlocker({...ready(),description:'a a a a a a a a'})).toContain('meaningful characters');
});

test('budget and postcode property must be valid before publish',()=>{
 expect(jobPublishBlocker({...ready(),budget:'12.345'})).toContain('valid budget');
 expect(jobPublishBlocker({...ready(),budget:''})).toBe('');
 const postcodeSite={...site,precision:'postcode' as const,label:'SW1A 1AA'};
 expect(jobPublishBlocker({...ready(),site:postcodeSite,checkedSite:postcodeSite,manualProperty:'!!!'})).toContain('valid house number');
 expect(jobPublishBlocker({...ready(),site:postcodeSite,checkedSite:postcodeSite,manualProperty:'14 High Street'})).toBe('');
});

test('temporary fallback is explicit and cannot bypass address verification',()=>{
 expect(jobPublishBlocker({...ready(),territoryVerified:false,manualFallbackAllowed:true})).toBe('');
 expect(jobPublishBlocker({...ready(),territoryVerified:false,manualFallbackAllowed:true,checkedSite:null})).toContain('Wait for this address');
 expect(jobPublishBlocker({...ready(),busy:true})).toContain('Saving');
});

test('rejects malformed address-provider labels before the publish action',()=>{
 expect(jobPublishBlocker({...ready(),site:{...site,label:'   '},checkedSite:{...site,label:'   '}})).toContain('valid property address');
 const tooLong={...site,label:'A'.repeat(251)};
 expect(jobPublishBlocker({...ready(),site:tooLong,checkedSite:tooLong})).toContain('valid property address');
 const postcodeSite={...site,precision:'postcode' as const,label:'SW1A 1AA'};
 expect(jobPublishBlocker({...ready(),site:postcodeSite,checkedSite:postcodeSite,manualProperty:'14 High Street'})).toBe('');
 const oversized={...postcodeSite,label:'X'.repeat(245)};
 expect(jobPublishBlocker({...ready(),site:oversized,checkedSite:oversized,manualProperty:'14 High Street'})).toContain('valid house number');
});
