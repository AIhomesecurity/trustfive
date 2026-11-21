import {defineConfig,devices} from '@playwright/test';

// Run only by explicit choice with the genuine protected staging preview URL.
// The ordinary CI/browser suite never executes these authenticated tests.
// No test account, secret or personal address belongs in source control.
const baseURL=process.env.TRUSTFIVE_STAGING_BASE_URL;
if(!baseURL||!/^https:\/\//i.test(baseURL))
 throw Error('Set TRUSTFIVE_STAGING_BASE_URL to an authorised HTTPS staging preview');

export default defineConfig({
 testDir:'./tests/staging',
 fullyParallel:false,
 workers:1,
 forbidOnly:true,
 retries:0,
 reporter:'list',
 use:{
  baseURL,
  // Auth tests enter live staging credentials. Never retain traces, videos
  // or screenshots because these may contain passwords or private records.
  trace:'off',
  screenshot:'off',
  video:'off',
  actionTimeout:20000
 },
 projects:[{name:'staging-chromium',use:{...devices['Desktop Chrome']}}]
});
