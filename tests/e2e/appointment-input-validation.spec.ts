import {test,expect} from '@playwright/test';
import {isValidIanaTimeZone,validateAppointmentInput} from '../../lib/appointment-input-validation';

const now=new Date('2026-11-21T12:00:00.000Z');
const validStart='2026-11-22T09:00';
const validEnd='2026-11-22T10:00';
const input=(start=validStart,end=validEnd,timezone='Europe/London')=>({start,end,timezone});

test('Valid future appointment is accepted and keeps exact UTC timestamps',()=>{
 const result=validateAppointmentInput(input(),now);
 expect(result.ok).toBe(true);
 if(result.ok){
  expect(result.startsAt).toBe(new Date(validStart).toISOString());
  expect(result.endsAt).toBe(new Date(validEnd).toISOString());
  expect(result.timezone).toBe('Europe/London');
 }
});

test('Missing, malformed and impossible dates are rejected with field-level errors',()=>{
 expect(validateAppointmentInput(input('',validEnd),now)).toMatchObject({ok:false,field:'start'});
 expect(validateAppointmentInput(input(validStart,''),now)).toMatchObject({ok:false,field:'end'});
 expect(validateAppointmentInput(input('not-a-date',validEnd),now)).toMatchObject({ok:false,field:'start'});
 expect(validateAppointmentInput(input('2026-02-30T10:00',validEnd),now)).toMatchObject({ok:false,field:'start'});
 expect(validateAppointmentInput(input(validStart,'2026-11-22T25:00'),now)).toMatchObject({ok:false,field:'end'});
});

test('Reversed, equal and past appointment windows are rejected',()=>{
 expect(validateAppointmentInput(input(validEnd,validStart),now)).toMatchObject({ok:false,field:'end'});
 expect(validateAppointmentInput(input(validStart,validStart),now)).toMatchObject({ok:false,field:'end'});
 expect(validateAppointmentInput(input('2026-11-20T09:00','2026-11-20T10:00'),now)).toMatchObject({ok:false,field:'start'});
});

test('Only valid IANA time zones are accepted',()=>{
 expect(isValidIanaTimeZone('Europe/London')).toBe(true);
 expect(isValidIanaTimeZone('Etc/UTC')).toBe(true);
 expect(isValidIanaTimeZone('Mars/Olympus')).toBe(false);
 expect(isValidIanaTimeZone('UTC+99')).toBe(false);
 expect(isValidIanaTimeZone('')).toBe(false);
 expect(isValidIanaTimeZone('a'.repeat(81))).toBe(false);
 expect(validateAppointmentInput(input(validStart,validEnd,'Mars/Olympus'),now)).toMatchObject({ok:false,field:'timezone'});
});

test('Validation messages are actionable and never expose internal errors',()=>{
 for(const [result,fragment] of [
  [validateAppointmentInput(input('',validEnd),now),'start date and time'],
  [validateAppointmentInput(input(validEnd,validStart),now),'after the start'],
  [validateAppointmentInput(input('2026-11-20T09:00','2026-11-20T10:00'),now),'in the future'],
  [validateAppointmentInput(input(validStart,validEnd,'Mars/Olympus'),now),'iana time zone']
 ] as const){
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.message.toLowerCase()).toContain(fragment);
 }
});
