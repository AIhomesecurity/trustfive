/** Validate third-party geocoding results before presenting property suggestions.
 * These are location hints, not proof of ownership or TrustFive territory. */
export type AddressSuggestion={
 label:string;latitude:number;longitude:number;postcode:string|null;
 precision:'address'|'postcode';country:string;
};
type ProviderResult={
 formatted?:unknown;lat?:unknown;lon?:unknown;postcode?:unknown;
 country_code?:unknown;housenumber?:unknown;
};

export function geoapifySuggestions(results:unknown):AddressSuggestion[]{
 if(!Array.isArray(results))return [];
 const suggestions:AddressSuggestion[]=[];
 const seen=new Set<string>();
 for(const raw of results.slice(0,30)){
  if(!raw||typeof raw!=='object')continue;
  const r=raw as ProviderResult;
  if(typeof r.formatted!=='string'||typeof r.lat!=='number'||typeof r.lon!=='number'||
     typeof r.country_code!=='string')continue;
  const label=r.formatted.trim().replace(/\s+/g,' ');
  const country=r.country_code.trim().toUpperCase();
  if(!label||label.length>250||!Number.isFinite(r.lat)||!Number.isFinite(r.lon)||
     Math.abs(r.lat)>90||Math.abs(r.lon)>180||!/^[A-Z]{2}$/.test(country))continue;
  const postcode=typeof r.postcode==='string'&&r.postcode.trim().length<=24?
   r.postcode.trim()||null:null;
  // House-level precision is only claimed if the provider actually returned
  // a house number, not merely a street or locality.
  const hasHouse=typeof r.housenumber==='string'&&r.housenumber.trim().length>0;
  const suggestion:AddressSuggestion={
   label,latitude:r.lat,longitude:r.lon,postcode,
   precision:hasHouse?'address':'postcode',country
  };
  const identity=country+'|'+label+'|'+r.lat+'|'+r.lon;
  if(!seen.has(identity)){seen.add(identity);suggestions.push(suggestion);}
  if(suggestions.length===6)break;
 }
 return suggestions;
}
