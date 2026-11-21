import {test,expect} from '@playwright/test';
import {directoryStateCopy,directoryViewState} from '../../lib/directory-view-state';
import {directoryEmptyCopy} from '../../components/directory-empty-state';

const base={catalogLoading:false,catalogError:'',resultsLoading:false,resultsError:'',resultCount:0};

test('Directory only ever has one active view state, with failures ahead of loading',()=>{
 expect(directoryViewState(base)).toBe('empty');
 expect(directoryViewState({...base,resultCount:2})).toBe('results');
 expect(directoryViewState({...base,catalogLoading:true})).toBe('searching');
 expect(directoryViewState({...base,resultsLoading:true})).toBe('searching');
 expect(directoryViewState({...base,resultsError:'rpc failed',resultsLoading:true})).toBe('search-error');
 expect(directoryViewState({...base,catalogError:'offline',resultsError:'rpc failed',resultCount:3})).toBe('catalog-error');
});

test('Zero, loading and failure copy stay distinct and never invent providers',()=>{
 const empty=directoryEmptyCopy({hasLocation:false,hasTrade:true,hasArea:true});
 const loading=directoryStateCopy('searching');
 const searchError=directoryStateCopy('search-error');
 const catalogError=directoryStateCopy('catalog-error');
 expect(new Set([empty.title,loading.title,searchError.title,catalogError.title]).size).toBe(4);
 expect(loading.description).toContain('Unverified listings are never shown');
 expect(searchError.description).toContain('trade and area are kept');
 expect(catalogError.description).toContain('never show invented listings');
 for(const copy of [empty,loading,searchError,catalogError]){
  expect(copy.description).not.toMatch(/five available|demo providers|guaranteed five|top five professionals ready/i);
 }
});
