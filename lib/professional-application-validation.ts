export type ProfessionalApplicationInput={
 businessName:string;
 experienceYears:string|number;
 about:string;
 tradeId:string;
 areaId:string;
 tradeIds:readonly string[];
 areaIds:readonly string[];
};
export type ProfessionalApplicationField='businessName'|'experienceYears'|'about'|'tradeId'|'areaId';
export type ProfessionalApplicationValues={
 businessName:string;
 experienceYears:number;
 about:string;
 tradeId:string;
 areaId:string;
};
export type ProfessionalApplicationValidation=
 | {ok:true;values:ProfessionalApplicationValues}
 | {ok:false;field:ProfessionalApplicationField;message:string};

const BUSINESS_MIN=2,BUSINESS_MAX=120;
const YEARS_MIN=0,YEARS_MAX=80;
const ABOUT_MIN=30,ABOUT_MAX=3000;

/** Collapse all whitespace runs to single spaces and trim the edges. */
export function normaliseText(value:string):string{
 return value.replace(/\s+/g,' ').trim();
}

function meaningfulLength(value:string):number{
 return normaliseText(value).length;
}

/**
 * Validate and normalise a professional application before any write.
 * Loaded option ids are passed in so a hand-crafted id cannot be submitted.
 */
export function validateProfessionalApplication(input:ProfessionalApplicationInput):ProfessionalApplicationValidation{
 const businessName=normaliseText(input.businessName);
 if(meaningfulLength(businessName)<BUSINESS_MIN||meaningfulLength(businessName)>BUSINESS_MAX){
  return {ok:false,field:'businessName',message:`Enter a business or trading name of ${BUSINESS_MIN}-${BUSINESS_MAX} characters.`};
 }
 if(!input.tradeId||!input.tradeIds.includes(input.tradeId)){
  return {ok:false,field:'tradeId',message:'Choose a trade from the list.'};
 }
 if(!input.areaId||!input.areaIds.includes(input.areaId)){
  return {ok:false,field:'areaId',message:'Choose a local service area from the list.'};
 }
 const rawYears=String(input.experienceYears).trim();
 if(!/^\d+$/.test(rawYears)){
  return {ok:false,field:'experienceYears',message:'Enter a whole number of years of experience.'};
 }
 const experienceYears=Number(rawYears);
 if(!Number.isInteger(experienceYears)||experienceYears<YEARS_MIN||experienceYears>YEARS_MAX){
  return {ok:false,field:'experienceYears',message:`Enter years of experience between ${YEARS_MIN} and ${YEARS_MAX}.`};
 }
 const about=normaliseText(input.about);
 if(meaningfulLength(about)<ABOUT_MIN||meaningfulLength(about)>ABOUT_MAX){
  return {ok:false,field:'about',message:`Describe your services and qualifications in ${ABOUT_MIN}-${ABOUT_MAX} characters.`};
 }
 return {ok:true,values:{businessName,experienceYears,about,tradeId:input.tradeId,areaId:input.areaId}};
}
