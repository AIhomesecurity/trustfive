import {expect,test} from '@playwright/test';

/** Phase 5: behavioural mobile and accessibility checks. These assert real
 * layout and focus behaviour rather than only comparing screenshots. */
const customerPages=['/','/services?trade=plumbing','/coverage','/account'];
const widths=[320,360,390,768,1024,1440];

for(const width of widths){
 test(`Customer pages remain horizontally stable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:820});
  for(const path of customerPages){
   await page.goto(path);
   await expect(page.locator('main').first()).toBeVisible();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   expect(overflow,`Unexpected horizontal overflow on ${path} at ${width}px`).toBeLessThanOrEqual(1);
  }
 });
}

test('Keyboard navigation produces a visible focus indicator',async({page})=>{
 await page.goto('/services');
 await page.keyboard.press('Tab');
 const focus=await page.evaluate(()=>{
  const visible=document.querySelectorAll(':focus-visible');
  const active=document.activeElement as HTMLElement|null;
  return {count:visible.length,tag:active?.tagName||'',outline:active?getComputedStyle(active).outlineStyle:'none'};
 });
 expect(focus.count,`Tab should move focus to an interactive control`).toBeGreaterThan(0);
 expect(focus.tag).not.toBe('BODY');
});

test('Reduced motion preference disables animated scrolling',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await expect(page.locator('main').first()).toBeVisible();
 const behaviour=await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior);
 expect(behaviour).toBe('auto');
});

test('Search and account forms expose programmatic labels',async({page})=>{
 await page.goto('/services');
 await expect(page.getByLabel('Trade or service')).toBeVisible();
 await expect(page.getByLabel('Your postcode or street address')).toBeVisible();
 await page.goto('/account/reset');
 await expect(page.getByLabel('Email address')).toBeVisible();
 await expect(page.getByRole('button',{name:'Email reset link'})).toBeVisible();
});
