export type BusinessProfileInput={
 name:string;
 description:string;
 website:string;
 phone:string;
};
export type BusinessProfileField='name'|'description'|'website'|'phone';
export type BusinessProfileValues={
 displayName:string;
 description:string;
 websiteUrl:string|null;
 publicPhone:string|null;
};
export type BusinessProfileValidation=
 | {ok:true;values:BusinessProfileValues}
 | {ok:false;field:BusinessProfileField;message:string};

const NAME_MIN=2,NAME_MAX=120;
const DESCRIPTION_MIN=30,DESCRIPTION_MAX=4000;
const PHONE_MIN=7,PHONE_MAX=30;

/** Collapse whitespace runs to single spaces and trim the edges. */
export function normaliseProfileText(value:string):string{
 return value.replace(/\s+/g,' ').trim();
}

function isPublicHttpsUrl(value:string):boolean{
 let url:URL;
 try{url=new URL(value);}catch{return false;}
 if(url.protocol!=='https:')return false;
 if(url.username||url.password)return false;
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!host||!host.includes('.'))return false;
 if(host.includes(':'))return false; // IPv6 literals
 if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))return false; // IPv4 literals, public or private
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
    host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid'))return false;
 return true;
}

function isValidPhone(value:string):boolean{
 if(value.length<PHONE_MIN||value.length>PHONE_MAX)return false;
 if(!/^\+?[0-9 ()\-]{7,30}$/.test(value))return false;
 const digits=value.replace(/\D/g,'').length;
 return digits>=7&&digits<=30;
}

/** Validate and normalise a public business-page draft before any write. */
export function validateBusinessProfile(input:BusinessProfileInput):BusinessProfileValidation{
 const displayName=normaliseProfileText(input.name);
 if(displayName.length<NAME_MIN||displayName.length>NAME_MAX){
  return {ok:false,field:'name',message:`Enter a business name of ${NAME_MIN}-${NAME_MAX} characters.`};
 }
 const description=normaliseProfileText(input.description);
 if(description.length<DESCRIPTION_MIN||description.length>DESCRIPTION_MAX){
  return {ok:false,field:'description',message:`Describe your business in ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`};
 }
 const websiteUrl=input.website.trim()||null;
 if(websiteUrl&&!isPublicHttpsUrl(websiteUrl)){
  return {ok:false,field:'website',message:'Enter a public HTTPS website URL, or leave it blank.'};
 }
 const publicPhone=normaliseProfileText(input.phone)||null;
 if(publicPhone&&!isValidPhone(publicPhone)){
  return {ok:false,field:'phone',message:'Enter a telephone number of 7-30 characters using digits, spaces, +, - or brackets.'};
 }
 return {ok:true,values:{displayName,description,websiteUrl,publicPhone}};
}
