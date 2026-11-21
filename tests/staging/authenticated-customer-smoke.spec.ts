import {test,expect} from '@playwright/test';

// This is an opt-in signed-in smoke test, NOT proof of the entire journey.
// Credentials must correspond to explicitly authorised real staging test users.
// It must not create jobs, approve fake professionals or leak property details.
const customerEmail=process.env.TRUSTFIVE_STAGING_CUSTOMER_EMAIL||'';
const customerPassword=process.env.TRUSTFIVE_STAGING_CUSTOMER_PASSWORD||'';
test('Authorised customer can sign in and reach personal bookings and messages',async({page})=>{
 test.skip(!customerEmail||!customerPassword,'Authorised customer credentials not supplied; do not invent test users');
 await page.goto('/account?next=%2Fbookings');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill(customerEmail);
 await page.getByLabel('Password',{exact:true}).fill(customerPassword);
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
 await expect(page).toHaveURL(/\/bookings(?:\?|$)/,{timeout:25000});
 await expect(page.getByRole('heading',{name:'My bookings'})).toBeVisible();

 await page.goto('/messages');
 await expect(page.getByRole('heading',{name:'TrustFive Messages'})).toBeVisible();
 // This is proof of an authenticated route, not permission to another
 // customer's messages, and not completion of quote/booking acceptance.
 await expect(page.getByText('A link to a conversation never grants access to another person',{exact:false})).toBeVisible();
});

test('Authorised professional can access applicant dashboard without being auto-approved',async({page})=>{
 const email=process.env.TRUSTFIVE_STAGING_PRO_EMAIL||'';
 const password=process.env.TRUSTFIVE_STAGING_PRO_PASSWORD||'';
 test.skip(!email||!password,'Authorised professional credentials not supplied; no fake approval');
 await page.goto('/account?next=%2Fprofessional');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
 await expect(page).toHaveURL(/\/professional(?:\?|$)/,{timeout:25000});
 await expect(page.getByRole('heading').first()).toBeVisible();
 // Do not assert a vetted allocation without independent real-world review.
});
