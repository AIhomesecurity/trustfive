export type AppointmentInput={start:string;end:string;timezone:string};
export type AppointmentField='start'|'end'|'timezone'|'form';
export type AppointmentValidation=
 | {ok:true;startsAt:string;endsAt:string;timezone:string}
 | {ok:false;field:AppointmentField;message:string};

const localDateTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** datetime-local values have no offset, so parse them as wall-clock time in the runtime zone. */
function parseLocalDateTime(value:string):Date|null{
 if(!localDateTime.test(value))return null;
 const [datePart,timePart]=value.split('T');
 const [year,month,day]=datePart.split('-').map(Number);
 const [hour,minute]=timePart.split(':').map(Number);
 if(year<1000||month<1||month>12||day<1||day>31||hour>23||minute>59)return null;
 const parsed=new Date(year,month-1,day,hour,minute);
 if(parsed.getFullYear()!==year||parsed.getMonth()!==month-1||parsed.getDate()!==day
   ||parsed.getHours()!==hour||parsed.getMinutes()!==minute)return null;
 return Number.isFinite(parsed.getTime())?parsed:null;
}

export function isValidIanaTimeZone(zone:string):boolean{
 if(!zone||zone.length>80||!/^[A-Za-z0-9_+.\-/]+$/.test(zone))return false;
 try{new Intl.DateTimeFormat('en-GB',{timeZone:zone});return true;}catch{return false;}
}

/** Validate before any RPC call; returns UTC ISO timestamps for a valid future appointment. */
export function validateAppointmentInput(input:AppointmentInput,now:Date=new Date()):AppointmentValidation{
 if(!isValidIanaTimeZone(input.timezone))return {ok:false,field:'timezone',message:'Choose a valid IANA time zone, for example Europe/London.'};
 const begins=parseLocalDateTime(input.start);
 if(!begins)return {ok:false,field:'start',message:'Enter a valid start date and time.'};
 const finishes=parseLocalDateTime(input.end);
 if(!finishes)return {ok:false,field:'end',message:'Enter a valid end date and time.'};
 if(finishes<=begins)return {ok:false,field:'end',message:'The end time must be after the start time.'};
 if(begins<=now)return {ok:false,field:'start',message:'Choose a start time in the future.'};
 return {ok:true,startsAt:begins.toISOString(),endsAt:finishes.toISOString(),timezone:input.timezone};
}
