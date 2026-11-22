import {expect,test} from '@playwright/test';
import {socialGroupAreaLabel,socialGroupSearchPattern} from '../../lib/social-group-discovery';

test('public group search treats user input literally instead of wildcard expansion',()=>{
 expect(socialGroupSearchPattern('')).toBeNull();
 expect(socialGroupSearchPattern('  cctv  ')).toBe('%cctv%');
 expect(socialGroupSearchPattern('CCTV_100%\\')).toBe('%CCTV\\_100\\%\\\\%');
 expect(socialGroupSearchPattern('a'.repeat(150))?.length).toBe(122);
});

test('group labels only use existing configured neighbourhoods',()=>{
 const areas=[{id:'a',area_name:'Walthamstow',city:'London'}];
 expect(socialGroupAreaLabel('a',areas)).toBe('Walthamstow, London');
 expect(socialGroupAreaLabel('unknown',areas)).toBe('Community area');
});
