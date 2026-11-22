import {expect,test} from '@playwright/test';
import {draftAfterThreadChange,shouldClearSentDraft} from '../../lib/message-draft-guard';

// Pure regression tests: no users, network requests or private conversations.
test.describe('private quote message draft isolation',()=>{
 test('retains draft when selecting the same thread',()=>{
  expect(draftAfterThreadChange('quote-a','quote-a','unfinished reply')).toBe('unfinished reply');
 });
 test('discards draft when switching recipients',()=>{
  expect(draftAfterThreadChange('quote-a','quote-b','private address details')).toBe('');
 });
 test('discards draft when access to the selected conversation disappears',()=>{
  expect(draftAfterThreadChange('quote-a','','private message')).toBe('');
 });
 test('only clears the unchanged sent draft in its original thread',()=>{
  expect(shouldClearSentDraft('quote-a','quote-a','Hello',' Hello ')).toBe(true);
  expect(shouldClearSentDraft('quote-a','quote-b','Hello','Hello')).toBe(false);
 });
 test('late success cannot erase newly typed text or another thread draft',()=>{
  expect(shouldClearSentDraft('quote-a','quote-a','Hello','Hello again')).toBe(false);
  expect(shouldClearSentDraft('quote-a','quote-b','Hello','Hello')).toBe(false);
 });
});
