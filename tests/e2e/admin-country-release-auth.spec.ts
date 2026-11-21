import {test,expect} from '@playwright/test';

test('Anonymous visitors must authenticate before country legal/payment release review',async({page})=>{
 await page.goto('/admin/release');
 await expect(page).toHaveURL(/\/account\?next=/);
 const destination=new URL(page.url()).searchParams.get('next');
 expect(destination).toBe('/admin/release');
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Record reviewed decision'})).toHaveCount(0);
 await expect(page.getByText('Missing approvals')).toHaveCount(0);
});

test('Anonymous visitors cannot inspect country launch readiness either',async({page})=>{
 await page.goto('/admin/readiness');
 await expect(page).toHaveURL(/\/account\?next=/);
 await expect(page.getByText('Verified operating evidence')).toHaveCount(0);
});
