import {expect,test} from '@playwright/test';
import {communityGroupLocationLabel} from '../../lib/community-group-location';

// Event cards reuse the same display-only area label as group cards.
// A missing service-area record must never be represented as a known locality.
test('event area labels use listed neighbourhood and city without claiming verification',()=>{
 const areas=[{id:'listed',area_name:'Northern Quarter',city:'Manchester'}];
 expect(communityGroupLocationLabel('listed',areas)).toBe('Northern Quarter, Manchester');
 expect(communityGroupLocationLabel('unlisted',areas)).toBe('Area unavailable');
});

test('event area labels never expose empty or whitespace-only locality names',()=>{
 expect(communityGroupLocationLabel('blank',[{id:'blank',area_name:'  ',city:' '}])).toBe('Area unavailable');
 expect(communityGroupLocationLabel('missing',[])).toBe('Area unavailable');
});
