import {test,expect} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import DirectoryEmptyState from '../../components/directory-empty-state';
import DirectoryStatePanel from '../../components/directory-state-panel';
import {directoryStateCopy} from '../../lib/directory-view-state';

const jobHref='/jobs?trade=cctv-installation&area=verified-area';

test('Zero-results state keeps the selected trade and area and labels its controls',()=>{
 const html=renderToStaticMarkup(createElement(DirectoryEmptyState,{
  context:{hasLocation:false,hasTrade:true,hasArea:true},onReset:()=>{},jobHref
 }));
 expect(html).toContain('role="status"');
 expect(html).toContain('aria-labelledby="directory-empty-title"');
 expect(html).toContain('id="directory-empty-title"');
 expect(html).toContain('trade=cctv-installation');
 expect(html).toContain('area=verified-area');
 expect(html).toContain('type="button"');
 expect(html).toContain('Post your job');
});

test('Error panel is announced, retryable and preserves the return path',()=>{
 const html=renderToStaticMarkup(createElement(DirectoryStatePanel,{
  tone:'error',copy:directoryStateCopy('search-error'),jobHref,onRetry:()=>{}
 }));
 expect(html).toContain('role="alert"');
 expect(html).toContain('Try again');
 expect(html).toContain('trade=cctv-installation');
 expect(html).toContain('area=verified-area');
 expect(html).not.toContain('aria-busy="true"');
});

test('Loading panel is a polite busy status without retry noise',()=>{
 const html=renderToStaticMarkup(createElement(DirectoryStatePanel,{
  tone:'loading',copy:directoryStateCopy('searching'),jobHref
 }));
 expect(html).toContain('role="status"');
 expect(html).toContain('aria-busy="true"');
 expect(html).not.toContain('role="alert"');
 expect(html).not.toContain('Try again');
 expect(html).toContain('trade=cctv-installation');
});
