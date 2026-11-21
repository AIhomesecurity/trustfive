import {test,expect} from '@playwright/test';
import {areaForJobForm,jobPostingHref,resolveJobFormContext} from '../../lib/job-form-context';

// P0: authenticated customer journey acceptance — password recovery, trade/area
// preservation through authentication, and pre-journey access fencing.
// These run against the CI project anonymously; the authenticated
// customer -> job -> quote -> booking leg itself is verified on staging
// (see docs/staging-authenticated-journey-acceptance.md).

test('Password reset page collects the account email and shows an honest outcome',async({page})=>{
  await page.goto('/account/reset');
  await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();
  const email=page.getByLabel('Email address');
  await expect(email).toBeVisible();
  await email.fill('customer@example.com');
  await page.getByRole('button',{name:'Email reset link'}).click();
  // The app either confirms the email or reports why it could not send; it
  // never leaves the outcome blank.
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('link',{name:'Back to sign in'})).toHaveAttribute('href',/\/account$/);
});

test('Password update page refuses without a session and rejects mismatched passwords',async({page})=>{
  await page.goto('/auth/update-password');
  await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();
  const newPassword=page.getByRole('textbox',{name:'New password',exact:true});
  const confirm=page.getByRole('textbox',{name:'Confirm new password',exact:true});
  await newPassword.fill('password123456');
  await confirm.fill('differentpassword1');
  await page.getByRole('button',{name:'Update password'}).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  // Matching passwords without a valid reset-link session: the page cannot
  // find the user and tells the customer to request a new link.
  await confirm.fill('password123456');
  await page.getByRole('button',{name:'Update password'}).click();
  await expect(page.getByText('Reset link expired or invalid. Request a new one.')).toBeVisible();
});

test('Selected trade and area are preserved through the customer auth redirect',async({page})=>{
  await page.goto('/jobs?trade=plumbing&area=test-area');
  await expect(page).toHaveURL(/\/account\?next=/);
  const next=new URL(page.url()).searchParams.get('next')||'';
  expect(next).toContain('trade=plumbing');
  expect(next).toContain('area=test-area');
  await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/account\?next=/);
  const signInNext=new URL(page.url()).searchParams.get('next')||'';
  expect(signInNext).toContain('trade=plumbing');
  expect(signInNext).toContain('area=test-area');
  await expect(page.getByRole('heading',{name:'Sign in to TrustFive'})).toBeVisible();
});

test('Anonymous customer journey never reaches the protected job form',async({page})=>{
  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/account\?next=/);
  const jobsNext=new URL(page.url()).searchParams.get('next')||'';
  expect(jobsNext).toBe('/jobs');
  await page.goto('/jobs?trade=plumbing&area=test-area');
  await expect(page).toHaveURL(/\/account\?next=/);
  const preserved=new URL(page.url()).searchParams.get('next')||'';
  expect(preserved).toBe('/jobs?trade=plumbing&area=test-area');
});

test('P0: selected CCTV trade and area survive the hand-off into the job form',()=>{
  const context=resolveJobFormContext(
    new URLSearchParams('trade=cctv-installation&area=verified-area'),
    [{id:'cctv-trade-id',slug:'cctv-installation'},{id:'plumbing-trade-id',slug:'plumbing'}],
    [{id:'verified-area'},{id:'other-area'}]
  );
  expect(context).toEqual({trade:'cctv-trade-id',area:'verified-area'});
  // Directory and auth effects run before an address is chosen: keep both hints.
  expect(areaForJobForm(context.area,false,'')).toBe('verified-area');
  // A new address may only replace the area with one verified for that address.
  expect(areaForJobForm(context.area,true,'')).toBe('');
  expect(areaForJobForm(context.area,true,'address-area')).toBe('address-area');
  expect(jobPostingHref('cctv-installation','verified-area')).toBe('/jobs?trade=cctv-installation&area=verified-area');
});

test('Unknown trade or area hints fail closed on the job form',()=>{
  expect(resolveJobFormContext(
    new URLSearchParams('trade=unknown-trade&area=unknown-area'),
    [{id:'cctv-trade-id',slug:'cctv-installation'}],
    [{id:'verified-area'}]
  )).toEqual({trade:'',area:''});
  expect(resolveJobFormContext(new URLSearchParams(),[],[])).toEqual({trade:'',area:''});
  expect(jobPostingHref('','')).toBe('/jobs');
});
