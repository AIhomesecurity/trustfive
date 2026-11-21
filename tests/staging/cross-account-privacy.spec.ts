import {expect,test,type Page} from '@playwright/test';

/**
 * Opt-in, read-only cross-account acceptance on the authorised STAGING site.
 * Do not set these values to fixtures or guessed IDs. A real second participant
 * must own the existing quote/booking IDs supplied by an authorised reviewer.
 *
 * Never generate a provider, book a job, grant address consent, seed data, or
 * record credentials/addresses in logs. No screenshots, video or tracing.
 */
const customer={
 email:process.env.TRUSTFIVE_STAGING_CUSTOMER_EMAIL||'',
 password:process.env.TRUSTFIVE_STAGING_CUSTOMER_PASSWORD||''
};
const unrelated={
 email:process.env.TRUSTFIVE_STAGING_PRO_EMAIL||'',
 password:process.env.TRUSTFIVE_STAGING_PRO_PASSWORD||''
};
const otherQuote=process.env.TRUSTFIVE_STAGING_OTHER_QUOTE_ID||'';
const otherBooking=process.env.TRUSTFIVE_STAGING_OTHER_BOOKING_ID||'';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function signInAs(page:Page,actor:{email:string;password:string}){
 await page.goto('/account?next=%2Fbookings');
 await page.getByRole('button',{name:'Sign in',exact:true}).first().click();
 await page.getByLabel('Email',{exact:true}).fill(actor.email);
 await page.getByLabel('Password',{exact:true}).fill(actor.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
 await expect(page).toHaveURL(/\/bookings(?:\?|$)/,{timeout:25000});
 await expect(page.getByRole('heading',{name:'My bookings'})).toBeVisible();
}

test('Authorised staging user cannot open a real quote belonging exclusively to another account',async({page})=>{
 test.skip(!customer.email||!customer.password||!unrelated.email||!unrelated.password,
  'Both separately authorised staging identities are required');
 test.skip(!uuid.test(otherQuote),
  'Reviewer must supply a genuine quote UUID owned ONLY by the other account; no invented record');
 test.skip(customer.email.trim().toLowerCase()===unrelated.email.trim().toLowerCase(),
  'Two genuinely different authorised staging identities are required');
 await signInAs(page,customer);
 await page.goto('/messages?quote='+otherQuote);
 await expect(page.getByRole('heading',{name:'TrustFive Messages'})).toBeVisible();
 await expect(page.getByRole('status').filter({
  hasText:/That conversation is not available to your account/
 })).toBeVisible();
 await expect(page.getByRole('region',{name:'Selected conversation'}).getByRole('heading',{
  name:'Select a conversation'
 })).toBeVisible();
 // The opaque URL identifier is only a navigation hint, not an access token.
 await expect(page.locator('.conversation-bubble')).toHaveCount(0);
});

test('Authorised staging user cannot open another account’s real booking or its private job address',async({page})=>{
 test.skip(!customer.email||!customer.password||!unrelated.email||!unrelated.password,
  'Both separately authorised staging identities are required');
 test.skip(!uuid.test(otherBooking),
  'Reviewer must supply a genuine booking UUID owned ONLY by the other account');
 test.skip(customer.email.trim().toLowerCase()===unrelated.email.trim().toLowerCase(),
  'Two genuinely different authorised staging identities are required');
 await signInAs(page,customer);
 await page.goto('/bookings?booking='+otherBooking);
 await expect(page.getByRole('heading',{name:'My bookings'})).toBeVisible();
 await expect(page.getByRole('alert').filter({
  hasText:/That booking is not accessible to this account/
 })).toBeVisible();
 await expect(page.locator('#booking-'+otherBooking)).toHaveCount(0);
 // A denied booking must not render, regardless of whether a private
 // customer address would otherwise have been shared with its participants.
 // Never inspect or copy the other participant's actual address text.
 await expect(page.locator('[id="booking-'+otherBooking+'"]')).toHaveCount(0);
});
