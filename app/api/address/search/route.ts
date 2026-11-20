import {NextRequest,NextResponse} from 'next/server';
import {geoapifySuggestions,type AddressSuggestion} from '../../../../lib/address-suggestions';
const postcode=/^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i;
const fail=(message:string,status=400)=>NextResponse.json({suggestions:[],message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 let value:unknown;
 try{value=(await request.json()).query;}catch{return fail('Enter an address or UK postcode');}
 if(typeof value!=='string'||value.length>160)return fail('Enter an address or UK postcode');
 const query=value.trim().replace(/\s+/g,' ');
 if(query.length<3)return fail('Enter at least three characters');
 const key=process.env.GEOAPIFY_API_KEY;
 try{
  if(key){
   const url=new URL('https://api.geoapify.com/v1/geocode/autocomplete');
   url.searchParams.set('text',query);
   url.searchParams.set('limit','6');
   url.searchParams.set('format','json');
   url.searchParams.set('apiKey',key);
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5500)});
   if(response.ok){
    const data=await response.json() as {results?:unknown};
    const suggestions=geoapifySuggestions(data.results);
    return NextResponse.json({suggestions,message:suggestions.length?'':'No matching addresses found'},{headers:{'Cache-Control':'no-store'}});
   }
  }
  // Free fallback: a full UK postcode locates a postcode centroid, never an individual property.
  if(!postcode.test(query.replace(/\s+/g,'')))return fail('Enter a full UK postcode. Street and house suggestions will be available when address lookup is configured.',200);
  const response=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(query.replace(/\s+/g,'')),{cache:'no-store',signal:AbortSignal.timeout(5500)});
  if(!response.ok)return fail('That UK postcode could not be found',200);
  const data=await response.json() as {result?:{postcode?:string;latitude?:number;longitude?:number;admin_district?:string}};
  const info=data.result;
  if(!info||!Number.isFinite(info.latitude)||!Number.isFinite(info.longitude))return fail('Location unavailable for this postcode',200);
  return NextResponse.json({suggestions:[{label:[info.postcode,info.admin_district,'United Kingdom'].filter(Boolean).join(', '),latitude:info.latitude!,longitude:info.longitude!,postcode:info.postcode||null,precision:'postcode',country:'GB'} satisfies AddressSuggestion],message:'Postcode-centre location (not a specific house)'},{headers:{'Cache-Control':'no-store'}});
 }catch{return fail('Address lookup is temporarily unavailable',503);}
}
