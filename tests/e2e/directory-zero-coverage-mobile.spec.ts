import {expect,test} from '@playwright/test';

test.use({viewport:{width:360,height:740},isMobile:true,hasTouch:true});

test('postcode zero coverage explains precision and keeps the selected trade when changing location',async({page})=>{
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[
  {id:'fixture-cctv',name:'CCTV installation',slug:'cctv-installation'}
 ]}));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_nearby',route=>route.fulfill({json:[]}));
 await page.route('**/api/address/search',route=>route.fulfill({json:{suggestions:[
  {label:'SW1A 1AA',latitude:51.5,longitude:-0.14,postcode:'SW1A 1AA',precision:'postcode',country:'GB'}
 ]}}));
 await page.goto('/services?trade=cctv-installation');
 const input=page.getByRole('combobox',{name:'Your postcode or street address'});
 await input.fill('SW1A 1AA');
 await expect(input).toHaveAttribute('aria-expanded','true');
 await input.press('Enter');
 await expect(page.getByRole('heading',{name:'No approved professionals near this postcode centre yet'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Post your job'})).toHaveAttribute('href','/jobs?trade=cctv-installation');
 await page.getByRole('button',{name:'Change search location'}).click();
 await expect(input).toBeFocused();
 await expect(page.getByLabel('Trade or service')).toHaveValue('fixture-cctv');
 await expect(page).toHaveURL(/\/services\?trade=cctv-installation$/);
});

test('keyboard reset from zero coverage keeps focus in the directory',async({page})=>{
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[
  {id:'fixture-alarm',name:'Home security',slug:'home-security'}
 ]}));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>route.fulfill({json:[]}));
 await page.goto('/services?q=burglar+alarm');
 await page.getByRole('button',{name:'Explore other trades'}).press('Enter');
 await expect(page.getByRole('heading',{name:'All approved professionals'})).toBeFocused();
 await expect(page.getByLabel('Trade or service')).toHaveValue('');
 await expect(page).toHaveURL(/\/services$/);
 await expect(page.getByRole('link',{name:'Post your job'})).toHaveAttribute('href','/jobs');
});
