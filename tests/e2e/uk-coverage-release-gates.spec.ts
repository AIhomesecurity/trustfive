import {expect,test} from '@playwright/test';

/** Public coverage is a demand signal, never a vetted territory or live booking promise. */
test('anonymous UK coverage request cannot create an approved territory',async({page})=>{
 await page.goto('/coverage');
 await expect(page.getByRole('heading',{name:/find or request trustfive coverage/i})).toBeVisible();
 await expect(page.getByText(/searchable area is not necessarily an approved trustfive territory/i)).toBeVisible();
 await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();
 await expect(page.getByRole('link',{name:/go to your account/i})).toHaveAttribute('href','/account?next=%2Fcoverage');
 await expect(page.getByText(/we store the postcode district only/i)).toBeVisible();
 await expect(page.getByText(/professional places open only after independent boundary and vetting reviews/i)).toBeVisible();
 expect(page.url()).not.toMatch(/postcode=|address=|latitude=|longitude=/i);
});

test('coverage form distinguishes a professional interest request from approval',async({page})=>{
 await page.goto('/coverage');
 await page.getByLabel('I am interested as').selectOption('professional');
 await expect(page.getByLabel('Trade or service')).toBeVisible();
 await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();
 await expect(page.getByText(/this is a request, not a verified operating boundary/i)).toHaveCount(0);
});
