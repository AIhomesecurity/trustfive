import {parseMoneyInput} from './international/money';

/** Parse an optional customer budget as exact pounds and pence, without accepting
 * exponent notation, signs, fractions of a penny or values above £10 million.
 * A blank value means no estimate, not a £0 budget.
 *
 * Backed by the exact-integer ISO 4217 money parser while preserving 100%
 * backwards compatibility for legacy `budget_pence` GBP workflows. */
export function parseJobBudgetPence(value:string):number|null{
 const input=value.trim();
 if(!input)return null;
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(input))throw new Error('Enter a valid budget in pounds and pence');
 const parsed=parseMoneyInput(input,'GBP',{minMinorUnits:0,maxMinorUnits:1_000_000_000});
 if(!parsed)return null;
 return parsed.minorUnits;
}
