import type {SelectedLocation} from '../components/address-search';
import {jobAddressLabel} from './job-address';
import {parseJobBudgetPence} from './job-budget';
import {meaningfulJobTextLength} from './job-text';

export type PublishReadiness={
 title:string;description:string;trade:string;site:SelectedLocation|null;
 manualProperty:string;area:string;budget:string;busy:boolean;
 territoryChecking:boolean;checkedSite:SelectedLocation|null;
 territoryVerified:boolean;manualFallbackAllowed:boolean;
};

/** The same validation rules used by the submit handler, before enabling Publish. */
export function jobPublishBlocker(input:PublishReadiness):string{
 if(input.busy)return 'Saving your request…';
 if(meaningfulJobTextLength(input.title)<5||meaningfulJobTextLength(input.description)<15)
  return 'Add a title (5 meaningful characters) and description (15 meaningful characters).';
 if(!input.trade)return 'Choose a trade.';
 if(!input.site)return 'Select a property address from the suggestions.';
 if(input.site.precision==='postcode'){
  try{jobAddressLabel(input.site,input.manualProperty);}
  catch{return 'Enter a valid house number/name and street for this postcode.';}
 }
 if(input.territoryChecking||input.checkedSite!==input.site)
  return 'Wait for this address to be checked against service territories.';
 if(!input.territoryVerified&&!input.manualFallbackAllowed)
  return 'This address cannot be published until territory eligibility is confirmed.';
 if(!input.area)return 'Choose a service territory.';
 try{parseJobBudgetPence(input.budget);}
 catch{return 'Enter a valid budget in pounds and pence, or leave it blank.';}
 return '';
}
