import {meaningfulJobTextLength} from './job-text';
import type {SelectedLocation} from '../components/address-search';

// A postcode centroid is not a property address. Require the customer to supply
// private premises details while retaining the honest 'postcode' coordinate precision.
export function jobAddressLabel(site:SelectedLocation,propertyDetails:string):string{
 // Treat address-provider labels as untrusted text: normalize line breaks and
 // repeated whitespace before storing a private job-site address.
 const selectedLabel=site.label.trim().replace(/\s+/g,' ');
 // Never publish a job with a missing or oversized private address, even if
 // the address-search provider returned a malformed selected suggestion.
 if(!selectedLabel||selectedLabel.length>250)throw new Error('Select a valid job-site address from the suggestions');
 if(site.precision==='address')return selectedLabel;
 const property=propertyDetails.trim().replace(/\s+/g,' ');
 if(property.length<5||property.length>100||meaningfulJobTextLength(property)<2)throw new Error('Enter your house number/name and street for a postcode-only location');
 const full=property+', '+selectedLabel;
 if(full.length>250)throw new Error('The combined property address is too long');
 return full;
}
