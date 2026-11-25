import {defineConfig,devices} from '@playwright/test';
// These specs each bind the same loopback Supabase fixture port.
const loopbackSpecs = [
 '**/complaints-disputes-lifecycle.spec.ts',
 '**/customer-booking-journey-mobile.spec.ts',
 '**/customer-quote-confirmation-browser.spec.ts',
 '**/marketplace-onboarding-journey-rehearsal.spec.ts',
 '**/notification-failure-recovery.spec.ts',
 '**/professional-availability-overlap.spec.ts',
 '**/signed-in-group-moderation.spec.ts',
 '**/signed-in-professional-appointment.spec.ts',
 '**/signed-in-messaging-load-retry.spec.ts',
 '**/signed-in-saved-discussions.spec.ts',
 '**/social-home-navigation-mobile.spec.ts',
 '**/social-slice1-membership-moderation.spec.ts',
 '**/social-slice2-mobile-drafts-a11y.spec.ts',
 '**/social-slice3-events-notifications.spec.ts',
 '**/social-slice4-media-spam-moderation.spec.ts',
];
const port=Number(process.env.PLAYWRIGHT_PORT||3112);
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./tests/e2e',
 fullyParallel:true,
 forbidOnly:Boolean(process.env.CI),
 retries:process.env.CI?1:0,
 reporter:process.env.CI?'list':'html',
 use:{
  baseURL,
  trace:'retain-on-failure',
  screenshot:'only-on-failure'
 },
 projects:[
  {name:'chromium',testIgnore:loopbackSpecs,use:{...devices['Desktop Chrome']}},
  {name:'chromium-loopback',testMatch:loopbackSpecs,workers:1,use:{...devices['Desktop Chrome']}}
 ],
 webServer:{
  command:`npm run start -- --hostname 127.0.0.1 --port ${port}`,
  url:`${baseURL}/api/health`,
  reuseExistingServer:!process.env.CI,
  timeout:90000
 }
});
