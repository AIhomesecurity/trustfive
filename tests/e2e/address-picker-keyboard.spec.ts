import {expect,test} from '@playwright/test';

// Deterministic provider fixture: no paid API, no live third-party request.
const suggestions=[
 {label:'10 Downing Street, London SW1A 2AA',latitude:51.5034,longitude:-0.1277,postcode:'SW1A 2AA',precision:'address',country:'GB'},
 {label:'Westminster, London SW1A',latitude:51.501,longitude:-0.125,postcode:'SW1A',precision:'postcode',country:'GB'}
];

test.beforeEach(async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions})});
 });
});

test('address picker exposes a keyboard-operable ARIA combobox',async({page})=>{
 await page.goto('/coverage');
 const input=page.getByRole('combobox',{name:/your postcode or street address/i});
 const listbox=page.getByRole('listbox',{name:/matching addresses/i});
 await expect(input).toHaveAttribute('aria-expanded','false');
 await input.fill('SW1A');
 await expect(listbox).toBeVisible();
 await expect(input).toHaveAttribute('aria-expanded','true');

 await input.press('ArrowDown');
 await expect(input).toHaveAttribute('aria-activedescendant',/-option-0$/);
 await expect(page.getByRole('option').nth(0)).toHaveAttribute('aria-selected','true');

 await input.press('ArrowDown');
 await expect(input).toHaveAttribute('aria-activedescendant',/-option-1$/);
 await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');

 await input.press('Enter');
 await expect(input).toHaveValue(suggestions[1].label);
 await expect(listbox).toHaveCount(0);
 await expect(input).toHaveAttribute('aria-expanded','false');

 await input.fill('Other');
 await expect(listbox).toBeVisible();
 await input.press('Escape');
 await expect(listbox).toHaveCount(0);
 await expect(input).toHaveAttribute('aria-expanded','false');
});
