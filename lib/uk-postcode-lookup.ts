import type {AddressSuggestion} from './address-suggestions';

/** All four constituent UK countries; exclude Crown Dependencies. */
const constituentCountries=new Set(['England','Scotland','Wales','Northern Ireland']);
const fullPostcode=/^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i;
const outwardCode=/^[A-Z]{1,2}\d[A-Z\d]?$/i;
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
function point(record:PostcodeRecord):{latitude:number;longitude:number}|null{
 if(typeof record.latitude!=='number'||typeof record.longitude!=='number'
  ||!Number.isFinite(record.latitude)||!Number.isFinite(record.longitude)
  ||Math.abs(record.latitude)>90||Math.abs(record.longitude)>180)return null;
 return {latitude:record.latitude,longitude:record.longitude};
}
/** The API's coordinates are a postcode/district centroid, never a house. */
export function ukPostcodeSuggestion(raw:unknown,kind:'full'|'outcode'):AddressSuggestion|null{
 if(!raw||typeof raw!=='object')return null;
 const info=raw as PostcodeRecord;
 const coordinates=point(info);
 if(!coordinates)return null;
 if(kind==='full'){
  if(typeof info.country!=='string'||!constituentCountries.has(info.country)
    ||typeof info.postcode!=='string'||!fullPostcode.test(info.postcode))return null;
  const postcode=info.postcode.toUpperCase().trim().replace(/\s+/g,' ');
  const district=typeof info.admin_district==='string'?info.admin_district.trim().slice(0,90):'';
  return {...coordinates,label:[postcode,district,'United Kingdom'].filter(Boolean).join(', '),
   postcode,precision:'postcode',country:'GB'};
 }
 if(typeof info.outcode!=='string'||!outwardCode.test(info.outcode))return null;
 const countries=Array.isArray(info.country)?info.country:[info.country];
 if(!countries.some(c=>typeof c==='string'&&constituentCountries.has(c)))return null;
 const districts=Array.isArray(info.admin_district)?info.admin_district:[info.admin_district];
 const district=districts.filter((d):d is string=>typeof d==='string'&&d.length>0)
  .slice(0,1).map(d=>d.trim().slice(0,90))[0]||'';
 const outcode=info.outcode.toUpperCase();
 return {...coordinates,label:[outcode+' postcode district',district,'United Kingdom'].filter(Boolean).join(', '),
  postcode:null,precision:'postcode',country:'GB'};
}
