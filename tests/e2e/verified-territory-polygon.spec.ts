import {test,expect} from '@playwright/test';
import {verifiedTerritoryPolygon} from '../../lib/verified-territory-polygon';

test('Manual reviewed polygon requires distinct valid surveyed coordinates',()=>{
 const polygon='-0.14,51.50\n-0.13,51.50\n-0.13,51.51\n-0.14,51.51';
 expect(verifiedTerritoryPolygon(polygon)).toBe(
  '((-0.14,51.5),(-0.13,51.5),(-0.13,51.51),(-0.14,51.51))'
 );
 expect(()=>verifiedTerritoryPolygon('-0.14,51.5\n-0.13,51.5')).toThrow(/3–30/);
 expect(()=>verifiedTerritoryPolygon(polygon+'\n-0.14,51.50')).toThrow(/repeat boundary/);
});

test('Manual boundary review rejects malformed, invalid, degenerate and crossing shapes',()=>{
 const invalid=[
  '151.20,-91\n151.21,-91\n151.20,-90',
  '181,51\n180,52\n179,50',
  '0,0\n1,1\n2,2',
  '0,0\n2,0\n0,2\n2,2', // crossing (self-intersection)
  '0,0\n1,0\n1,NaN',
  '0,0\n1,0\n1,0',
  '0,0\n1,0\n1,1;DROP TABLE service_areas',
 ];
 for(const input of invalid)expect(()=>verifiedTerritoryPolygon(input)).toThrow();
});

test('Unauthenticated visitors cannot open territory administration',async({page})=>{
 await page.goto('/admin/territories');
 await expect(page).toHaveURL(/\/account\?next=/);
});
