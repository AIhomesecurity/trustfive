import {test,expect} from '@playwright/test';
import {geoapifySuggestions} from '../../lib/address-suggestions';

test('Geocoder only returns credible location suggestions and never fabricates exactness',()=>{
 const suggestions=geoapifySuggestions([
  {formatted:' 14 High Street, London ',lat:51.502,lon:-0.14,country_code:'gb',postcode:'SW1A 1AA',housenumber:'14'},
  {formatted:' 14 High Street, London ',lat:51.502,lon:-0.14,country_code:'gb',postcode:'SW1A 1AA',housenumber:'14'},
  {formatted:'High Street, London',lat:51.5,lon:-0.13,country_code:'gb',postcode:'SW1A 1AA'},
  {formatted:'Unknown house',lat:91,lon:0,country_code:'gb',housenumber:'12'},
  {formatted:'Unknown country',lat:51,lon:0,country_code:'',housenumber:'12'},
  {formatted:'Bad longitude',lat:51,lon:-181,country_code:'gb'},
  {formatted:'Invalid latitude',lat:NaN,lon:0,country_code:'gb'},
  {formatted:'',lat:51,lon:0,country_code:'gb'},
  {formatted:'Incomplete',lat:'51.5',lon:0,country_code:'gb'}
 ]);
 expect(suggestions).toEqual([
  {label:'14 High Street, London',latitude:51.502,longitude:-0.14,postcode:'SW1A 1AA',precision:'address',country:'GB'},
  {label:'High Street, London',latitude:51.5,longitude:-0.13,postcode:'SW1A 1AA',precision:'postcode',country:'GB'}
 ]);
});

test('Malformed upstream payloads fail closed and suggestion count stays bounded',()=>{
 expect(geoapifySuggestions(null)).toEqual([]);
 expect(geoapifySuggestions({results:{}})).toEqual([]);
 const repeated=Array.from({length:25},(_,i)=>({
  formatted:'Example property '+i,lat:51+i/1000,lon:0,country_code:'gb',housenumber:String(i)
 }));
 expect(geoapifySuggestions(repeated)).toHaveLength(6);
 expect(geoapifySuggestions([{formatted:'  ',lat:51,lon:0,country_code:'GB'}])).toEqual([]);
});
