import {test,expect} from '@playwright/test';

test('TrustFive landing page displays original branding and service navigation',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle(/TrustFive/i);
 await expect(page.getByRole('heading',{level:1})).toContainText(/truly trust/i);
 await expect(page.getByRole('link',{name:'Find a trusted professional'})).toBeVisible();
 await page.getByRole('link',{name:'Find a trusted professional'}).click();
 await expect(page).toHaveURL(/\/services$/);
 await expect(page.getByRole('heading',{name:'Find a TrustFive professional'})).toBeVisible();
});

test('Registration and sign-in tabs switch without a backend account',async({page})=>{
 await page.goto('/account');
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page.getByLabel('I am joining as')).toBeVisible();
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sign in to TrustFive'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Forgot your password?'})).toBeVisible();
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Anonymous members are redirected from personal accounts',async({page})=>{
 await page.goto('/dashboard');
 await expect(page).toHaveURL(/\/account$/);
 await page.goto('/community/groups');
 await expect(page).toHaveURL(/\/account$/);
 await page.goto('/schedule');
 await expect(page).toHaveURL(/\/account$/);
});

test('Health endpoint reports configured app without exposing credentials',async({request})=>{
 const response=await request.get('/api/health');
 expect(response.ok()).toBeTruthy();
 const payload=await response.json() as {service:string;status:string;timestamp:string};
 expect(payload.service).toBe('trustfive-web');
 expect(payload.status).toBe('ok');
 expect(payload.timestamp).toBeTruthy();
 expect(JSON.stringify(payload)).not.toContain('sb_publishable_');
});
