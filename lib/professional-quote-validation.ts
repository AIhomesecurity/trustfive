export type ProfessionalQuoteInput={amount:string;message:string};
export type ProfessionalQuoteField='amount'|'message';
export type ProfessionalQuoteValidation=
 | {ok:true;amountPence:number;message:string}
 | {ok:false;field:ProfessionalQuoteField;message:string};

const MIN_PENCE=100;
const MAX_PENCE=1000000000;
const MESSAGE_MIN=10;
const MESSAGE_MAX=3000;

/** Collapse all whitespace runs to single spaces and trim the edges. */
export function normaliseQuoteText(value:string):string{
 return value.replace(/\s+/g,' ').trim();
}

/**
 * Parse a GBP string straight into integer pence without floating-point maths.
 * Accepts whole pounds or up to two decimal places; rejects signs and noise.
 */
export function gbpToPence(value:string):number|null{
 const trimmed=value.trim();
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(trimmed))return null;
 const [pounds,decimals='']=trimmed.split('.');
 const pence=Number(pounds)*100+Number(decimals.padEnd(2,'0'));
 if(!Number.isSafeInteger(pence))return null;
 return pence;
}

/** Validate a professional quote before any write; no payment is collected here. */
export function validateProfessionalQuote(input:ProfessionalQuoteInput):ProfessionalQuoteValidation{
 const amountPence=gbpToPence(input.amount);
 if(amountPence===null||amountPence<MIN_PENCE||amountPence>MAX_PENCE){
  return {ok:false,field:'amount',message:'Enter a quote between £1.00 and £10,000,000.00 using at most two decimal places.'};
 }
 const message=normaliseQuoteText(input.message);
 if(message.length<MESSAGE_MIN||message.length>MESSAGE_MAX){
  return {ok:false,field:'message',message:`Describe the scope of work in ${MESSAGE_MIN}-${MESSAGE_MAX} characters.`};
 }
 return {ok:true,amountPence,message};
}
