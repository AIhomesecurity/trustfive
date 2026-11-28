import {expect,test} from '@playwright/test';

test('Desktop Explore menu stays open across its pointer bridge and closes on pointer or focus exit',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const explore=page.locator('details.nav-more').first();
 const trigger=explore.locator('summary');
 const coverage=explore.getByRole('link',{name:'UK coverage'});
 await trigger.click();
 await expect(explore).toHaveAttribute('open','');
 await expect(coverage).toBeVisible();
 await coverage.hover();
 await expect(explore).toHaveAttribute('open','');
 await page.getByRole('heading',{name:'A clear, fair way to find local help.'}).hover();
 await expect(explore).not.toHaveAttribute('open','');

 await trigger.focus();
 await page.keyboard.press('Enter');
 await expect(explore).toHaveAttribute('open','');
 await coverage.focus();
 await expect(coverage).toBeFocused();
 await expect(explore).toHaveAttribute('open','');
 await page.getByRole('link',{name:'Post a job',exact:true}).focus();
 await expect(explore).not.toHaveAttribute('open','');
});
