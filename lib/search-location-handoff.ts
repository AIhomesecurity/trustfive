import type {SelectedLocation} from '../components/address-search';

/** Short-lived, tab-scoped handoff of a directory address into the job form.
 * The location is never placed in a URL, log or public listing. */
export const SEARCH_LOCATION_HANDOFF_KEY='trustfive-search-location-v1';
const MAX_AGE_MS=30*60*1000;

type StorageLike={
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
};
type StoredLocation=SelectedLocation&{savedAt:number};

function browserStore():StorageLike|null{
  try{return typeof sessionStorage==='undefined'?null:sessionStorage;}catch{return null;}
}
function validLocation(value:unknown):value is SelectedLocation{
  if(!value||typeof value!=='object')return false;
  const item=value as Record<string,unknown>;
  return typeof item.label==='string'&&item.label.trim().length>0&&item.label.length<=200
   &&typeof item.latitude==='number'&&Number.isFinite(item.latitude)&&Math.abs(item.latitude)<=90
   &&typeof item.longitude==='number'&&Number.isFinite(item.longitude)&&Math.abs(item.longitude)<=180
   &&(item.postcode===null||(typeof item.postcode==='string'&&item.postcode.length<=20))
   &&(item.precision==='address'||item.precision==='postcode')
   &&typeof item.country==='string'&&/^[A-Z]{2}$/.test(item.country);
}

export function saveSearchLocation(location:SelectedLocation,store:StorageLike|null=browserStore()):void{
  if(!store||!validLocation(location))return;
  try{
    const stored:StoredLocation={label:location.label.trim(),latitude:location.latitude,longitude:location.longitude,
      postcode:location.postcode,precision:location.precision,country:location.country,savedAt:Date.now()};
    store.setItem(SEARCH_LOCATION_HANDOFF_KEY,JSON.stringify(stored));
  }catch{/* Optional browser storage must never block directory search. */}
}

export function consumeSearchLocation(store:StorageLike|null=browserStore()):SelectedLocation|null{
  if(!store)return null;
  try{
    const raw=store.getItem(SEARCH_LOCATION_HANDOFF_KEY);
    store.removeItem(SEARCH_LOCATION_HANDOFF_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Partial<StoredLocation>;
    if(typeof parsed.savedAt!=='number'||!Number.isFinite(parsed.savedAt))return null;
    if(Date.now()-parsed.savedAt>MAX_AGE_MS||parsed.savedAt>Date.now()+60_000)return null;
    if(!validLocation(parsed))return null;
    return {label:parsed.label.trim(),latitude:parsed.latitude,longitude:parsed.longitude,
      postcode:parsed.postcode,precision:parsed.precision,country:parsed.country};
  }catch{return null;}
}

export function clearSearchLocation(store:StorageLike|null=browserStore()):void{
  try{store?.removeItem(SEARCH_LOCATION_HANDOFF_KEY);}catch{/* Ignore storage restrictions. */}
}
