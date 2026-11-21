export type DirectoryViewStateInput={
 catalogLoading:boolean;
 catalogError:string;
 resultsLoading:boolean;
 resultsError:string;
 resultCount:number;
};

export type DirectoryViewState='catalog-error'|'search-error'|'searching'|'empty'|'results';

/** One mutually exclusive state: a zero result, a load and a failure never render together. */
export function directoryViewState(input:DirectoryViewStateInput):DirectoryViewState{
 if(input.catalogError)return 'catalog-error';
 if(input.resultsError)return 'search-error';
 if(input.catalogLoading||input.resultsLoading)return 'searching';
 return input.resultCount>0?'results':'empty';
}

export type DirectoryStateCopy={title:string;description:string};

export function directoryStateCopy(state:Exclude<DirectoryViewState,'results'|'empty'>):DirectoryStateCopy{
 if(state==='catalog-error')return {
  title:'Service filters are temporarily unavailable',
  description:'We could not load the verified trade and area lists, so we cannot promise a correctly filtered directory. Please try again; we never show invented listings.'
 };
 if(state==='search-error')return {
  title:'Professional search is temporarily unavailable',
  description:'Your selected trade and area are kept. Please try again rather than relying on an incomplete result list.'
 };
 return {
  title:'Searching approved professionals…',
  description:'Checking currently approved providers for your trade and area. Unverified listings are never shown as available.'
 };
}
