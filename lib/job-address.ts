import type {SelectedLocation} from '../components/address-search';

// A postcode centroid is not a property address. Require the customer to supply
// private premises details while retaining the honest 'postcode' coordinate precision.
export function jobAddressLabel(site:SelectedLocation,propertyDetails:string):string{
 if(site.precision==='address')return site.label.trim();
 const property=propertyDetails.trim().replace(/\s+/g,' ');
 if(property.length<5||property.length>100)throw new Error('Enter your house number/name and street for a postcode-only location');
 const full=property+', '+site.label.trim();
 if(full.length>250)throw new Error('The combined property address is too long');
 return full;
}
