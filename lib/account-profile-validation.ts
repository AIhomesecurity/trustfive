export type AccountProfileInput={fullName:string;phone:string};
export type AccountProfileField='fullName'|'phone';
export type AccountProfileValues={fullName:string;phone:string};
export type AccountProfileValidation=
 | {ok:true;values:AccountProfileValues}
 | {ok:false;field:AccountProfileField;message:string};

const NAME_MIN=2,NAME_MAX=150;
const PHONE_MIN=7,PHONE_MAX=30;

/** Collapse whitespace runs to single spaces and trim the edges. */
export function normaliseAccountText(value:string):string{
 return value.replace(/\s+/g,' ').trim();
}

function isValidPhone(value:string):boolean{
 if(value.length<PHONE_MIN||value.length>PHONE_MAX)return false;
 if(!/^\+?[0-9 ()\-.]{7,30}$/.test(value))return false;
 const digits=value.replace(/\D/g,'').length;
 return digits>=7&&digits<=15;
}

/** Validate account profile fields before any write; roles and approval are untouched. */
export function validateAccountProfile(input:AccountProfileInput):AccountProfileValidation{
 const fullName=normaliseAccountText(input.fullName);
 if(fullName.length<NAME_MIN||fullName.length>NAME_MAX){
  return {ok:false,field:'fullName',message:`Enter your full name (${NAME_MIN}-${NAME_MAX} characters).`};
 }
 const phone=normaliseAccountText(input.phone);
 if(!isValidPhone(phone)){
  return {ok:false,field:'phone',message:'Enter a UK or international phone number of 7-30 characters using digits, spaces, +, - or brackets.'};
 }
 return {ok:true,values:{fullName,phone}};
}
