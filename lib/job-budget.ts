/** Parse an optional customer budget as exact pounds and pence, without accepting
 * exponent notation, signs, fractions of a penny or values above £10 million.
 * A blank value means no estimate, not a £0 budget. */
export function parseJobBudgetPence(value:string):number|null{
 const input=value.trim();
 if(!input)return null;
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(input))throw new Error('Enter a valid budget in pounds and pence');
 const [pounds,pence='']=input.split('.');
 const amount=Number(pounds)*100+Number(pence.padEnd(2,'0'));
 if(!Number.isSafeInteger(amount)||amount<0||amount>1_000_000_000)
  throw new Error('Enter a budget between £0 and £10,000,000');
 return amount;
}
