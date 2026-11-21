import type {AddressSuggestion} from './address-suggestions';

/** All four constituent UK countries; exclude Crown Dependencies. */
const constituentCountries=new Set(['England','Scotland','Wales','Northern Ireland']);
const fullPostcode=/^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i;
const outwardCode=/^[A-Z]{1,2}\d[A-Z\d]?$/i;
/** Empirical WGS84 bounds for England, Scotland, Wales and Northern Ireland. */
const UK_LAT_MIN=49.8;
const UK_LAT_MAX=60.9;
const UK_LON_MIN=-8.7;
const UK_LON_MAX=1.8;

type PostcodeRecord={
 postcode?:unknown;outcode?:unknown;latitude?:unknown;longitude?:unknown;
 admin_district?:unknown;country?:unknown;
};

/** Distinguish genuine full postcodes and outward districts from street search. */
export function ukPostcodeLookupKind(raw:string):'full'|'outcode'|null{
 const clean=raw.trim().replace(/\s+/g,'').toUpperCase();
 if(fullPostcode.test(clean))return 'full';
 if(outwardCode.test(clean))return 'outcode';
 return null;
}

export function ukPostcodeLookupPath(raw:string):string|null{
 const kind=ukPostcodeLookupKind(raw);
 if(!kind)return null;
 const cleaned=raw.trim().replace(/\s+/g,'').toUpperCase();
 return (kind==='full'?'/postcodes/':'/outcodes/')+encodeURIComponent(cleaned);
}

/** Extract a database-valid outward postcode (matching ^[A-Z]{1,2}[0-9][A-Z0-9]?$)
 * from a spaced/spaceless full postcode, outward code, or suggestion label. */
export function ukOutcodeFromInput(raw:string|null|undefined):string|null{
 if(typeof raw!=='string')return null;
 const trimmed=raw.trim();
 if(!trimmed)return null;
 const compact=trimmed.replace(/\s+/g,'').toUpperCase();
 if(outwardCode.test(compact))return compact;
 if(fullPostcode.test(compact)){
  const candidate=compact.slice(0,-3);
  return outwardCode.test(candidate)?candidate:null;
 }
 const firstToken=trimmed.split(/[\s,]/)[0]?.toUpperCase()||'';
 if(outwardCode.test(firstToken))return firstToken;
 if(fullPostcode.test(firstToken)){
  const candidate=firstToken.slice(0,-3);
  return outwardCode.test(candidate)?candidate:null;
 }
 return null;
}

function formatFullPostcode(raw:string):string{
 const compact=raw.trim().replace(/\s+/g,'').toUpperCase();
 return `${compact.slice(0,-3)} ${compact.slice(-3)}`;
}

function point(record:PostcodeRecord):{latitude:number;longitude:number}|null{
 if(typeof record.latitude!=='number'||typeof record.longitude!=='number'
  ||!Number.isFinite(record.latitude)||!Number.isFinite(record.longitude)
  ||record.latitude<UK_LAT_MIN||record.latitude>UK_LAT_MAX
  ||record.longitude<UK_LON_MIN||record.longitude>UK_LON_MAX)return null;
 return {latitude:record.latitude,longitude:record.longitude};
}

function firstValidDistrict(raw:unknown):string{
 const list=Array.isArray(raw)?raw:[raw];
 for(const item of list){
  if(typeof item==='string'){
   const clean=item.trim().slice(0,90);
   if(clean)return clean;
  }
 }
 return '';
}

function hasOnlyValidUkCountries(raw:unknown):boolean{
 const list=Array.isArray(raw)?raw:[raw];
 const values=list
  .filter((c):c is string=>typeof c==='string')
  .map(c=>c.trim())
  .filter(Boolean);
 if(!values.length)return false;
 return values.every(c=>constituentCountries.has(c));
}

/** The API's coordinates are a postcode/district centroid, never a house. */
export function ukPostcodeSuggestion(raw:unknown,kind:'full'|'outcode'):AddressSuggestion|null{
 if(!raw||typeof raw!=='object')return null;
 const info=raw as PostcodeRecord;
 const coordinates=point(info);
 if(!coordinates)return null;
 if(kind==='full'){
  if(typeof info.country!=='string'||!constituentCountries.has(info.country.trim())
    ||typeof info.postcode!=='string'||!fullPostcode.test(info.postcode.trim()))return null;
  const postcode=formatFullPostcode(info.postcode);
  const district=firstValidDistrict(info.admin_district);
  return {...coordinates,label:[postcode,district,'United Kingdom'].filter(Boolean).join(', '),
   postcode,precision:'postcode',country:'GB'};
 }
 if(typeof info.outcode!=='string'||!outwardCode.test(info.outcode.trim()))return null;
 if(!hasOnlyValidUkCountries(info.country))return null;
 const district=firstValidDistrict(info.admin_district);
 const outcode=info.outcode.trim().toUpperCase();
 return {...coordinates,label:[outcode+' postcode district',district,'United Kingdom'].filter(Boolean).join(', '),
  postcode:null,precision:'postcode',country:'GB'};
}
