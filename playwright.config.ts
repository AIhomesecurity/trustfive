import {defineConfig,devices} from '@playwright/test';
// These specs each bind the same loopback Supabase fixture port.
const loopbackSpecs = [
 '**/customer-booking-journey-mobile.spec.ts',
 '**/customer-quote-confirmation-browser.spec.ts',
 '**/marketplace-onboarding-journey-rehearsal.spec.ts',
 '**/signed-in-group-moderation.spec.ts',
 '**/signed-in-professional-appointment.spec.ts',
 '**/signed-in-messaging-load-retry.spec.ts',
 '**/signed-in-saved-discussions.spec.ts',
 '**/social-home-navigation-mobile.spec.ts',
 '**/social-slice1-membership-moderation.spec.ts',
];
export default defineConfig({
 testDir:'./tests/e2e',
 fullyParallel:true,
 forbidOnly:Boolean(process.env.CI),
 retries:process.env.CI?1:0,
 reporter:process.env.CI?'list':'html',
 use:{
  baseURL:'http://127.0.0.1:3112',
  trace:'retain-on-failure',
  screenshot:'only-on-failure'
 },
 projects:[
  {name:'chromium',testIgnore:loopbackSpecs,use:{...devices['Desktop Chrome']}},
  {name:'chromium-loopback',testMatch:loopbackSpecs,workers:1,use:{...devices['Desktop Chrome']}}
 ],
 webServer:{
  command:'npm run start -- --port 3112',
  url:'http://127.0.0.1:3112/api/health',
  reuseExistingServer:!process.env.CI,
  timeout:90000
 }
});
