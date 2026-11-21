import {NextRequest,NextResponse} from 'next/server';
import {geoapifySuggestions} from '../../../../lib/address-suggestions';
import {ukPostcodeLookupKind,ukPostcodeLookupPath,ukPostcodeSuggestion} from '../../../../lib/uk-postcode-lookup';

const fail=(message:string,status=400)=>NextResponse.json({suggestions:[],message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 let value:unknown;
 try{value=(await request.json()).query;}catch{return fail('Enter an address or UK postcode');}
 if(typeof value!=='string'||value.length>160)return fail('Enter an address or UK postcode');
 const query=value.trim().replace(/\s+/g,' ');
 if(query.length<2)return fail('Enter at least two characters');
 const kind=ukPostcodeLookupKind(query);
 // Two-character UK outward codes such as G1 are legitimate; arbitrary
 // two-letter fragments are not valid locations and must fail closed.
 if(query.length<3&&!kind)return fail('Enter a UK postcode or at least three address characters');
 try{
  // National postcode / district lookup is independent of the four example
  // service areas and needs no paid geocoding key. Supports England, Scotland,
  // Wales and Northern Ireland; no approved provider is implied.
  if(kind){
   const path=ukPostcodeLookupPath(query);
   if(!path)return fail('Invalid UK postcode',200);
   const response=await fetch('https://api.postcodes.io'+path,{
    cache:'no-store',signal:AbortSignal.timeout(5500)
   });
   if(!response.ok)return fail('This UK postcode or district was not found',200);
   const data=await response.json() as {result?:unknown};
   const suggestion=ukPostcodeSuggestion(data.result,kind);
   if(!suggestion)return fail('Location unavailable for this UK postcode',200);
   return NextResponse.json({
    suggestions:[suggestion],
    message:kind==='full'?'Postcode-centre location (not a specific house)':
     'Approximate postcode-district centre. Use a full postcode for job requests.'
   },{headers:{'Cache-Control':'no-store'}});
  }
  // Optional property-level address suggestions (Geoapify). Restrict to GB
  // so the public directory never mislabels foreign locations as UK coverage.
  const key=process.env.GEOAPIFY_API_KEY;
  if(key){
   const url=new URL('https://api.geoapify.com/v1/geocode/autocomplete');
   url.searchParams.set('text',query);
   url.searchParams.set('filter','countrycode:gb');
   url.searchParams.set('limit','6');
   url.searchParams.set('format','json');
   url.searchParams.set('apiKey',key);
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5500)});
   if(response.ok){
    const data=await response.json() as {results?:unknown};
    const suggestions=geoapifySuggestions(data.results).filter(s=>s.country==='GB');
    return NextResponse.json({suggestions,message:suggestions.length?'':'No matching UK addresses found'},
     {headers:{'Cache-Control':'no-store'}});
   }
  }
  return fail('Enter a full UK postcode or postcode district (for example BT1, CF10 or SW1A). Street and house lookup requires the configured address provider.',200);
 }catch{return fail('Address lookup is temporarily unavailable',503);}
}
