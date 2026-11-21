/** Count visible non-whitespace characters, not padding between words. */
export function meaningfulJobTextLength(value:string):number{
 return Array.from(value).filter(char=>!(/\s/u).test(char)).length;
}
