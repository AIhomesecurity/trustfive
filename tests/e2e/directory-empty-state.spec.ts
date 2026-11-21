import {test,expect} from '@playwright/test';
import {directoryEmptyCopy} from '../../components/directory-empty-state';

test('Live directory never implies fictional top-five coverage',()=>{
 const cases=[
  {hasLocation:true,hasTrade:true,hasArea:false},
  {hasLocation:false,hasTrade:true,hasArea:true},
  {hasLocation:false,hasTrade:false,hasArea:true},
  {hasLocation:false,hasTrade:true,hasArea:false},
  {hasLocation:false,hasTrade:false,hasArea:false}
 ];
 for(const context of cases){
  const copy=directoryEmptyCopy(context);
  expect(copy.title).toBeTruthy();
  expect(copy.description).toBeTruthy();
  expect(copy.action).toBeTruthy();
  expect(copy.description).not.toMatch(/demo providers|five available|guaranteed five/i);
 }
 expect(directoryEmptyCopy(cases[0]).description).toContain('verified service locations');
 expect(directoryEmptyCopy(cases[1]).description).toContain('independently approved');
 expect(directoryEmptyCopy(cases[4]).description).toContain('No demo listings');
});
