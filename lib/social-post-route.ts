/** Route parsing never treats arbitrary strings as a post identifier. */
export function socialPostIdFromRoute(value:string|string[]|undefined):string|null{
 if(typeof value!=='string')return null;
 const normalized=value.toLowerCase();
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
  ? normalized:null;
}
