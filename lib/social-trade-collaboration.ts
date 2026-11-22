/** Only structured, public-to-registered-professionals information is accepted.
 * No customer job IDs, locations, phone/email or free-text addresses.
 */
export const SOCIAL_ASSISTANCE_TYPES=[
 ['installation','Installation'],
 ['repair','Repair'],
 ['inspection','Inspection'],
 ['planning','Planning'],
 ['specialist_support','Specialist support'],
 ['other','Other specialist assistance']
] as const;
export type SocialAssistanceType=typeof SOCIAL_ASSISTANCE_TYPES[number][0];
export type SocialTradeRequest={
 id:string;creator_id:string;trade_id:string;area_id:string;
 assistance_type:SocialAssistanceType;earliest_week:string|null;
 status:'open'|'closed';created_at:string;
};
export type SocialTradeInterest={request_id:string;responder_id:string;created_at:string};

export function isSocialAssistanceType(value:string):value is SocialAssistanceType{
 return SOCIAL_ASSISTANCE_TYPES.some(item=>item[0]===value);
}
export function socialTradeRequestError(input:{
 userId:string;tradeId:string;tradeIds:readonly string[];
 areaId:string;areaIds:readonly string[];
 assistanceType:string;earliestWeek:string;
}):string|null{
 if(!input.userId)return 'Sign in as a registered professional to use Trade Network.';
 if(!input.tradeIds.includes(input.tradeId))return 'Choose an available trade category.';
 if(!input.areaIds.includes(input.areaId))return 'Choose a general service area.';
 if(!isSocialAssistanceType(input.assistanceType))return 'Choose a recognised assistance type.';
 if(input.earliestWeek&&!/^\d{4}-\d{2}-\d{2}$/.test(input.earliestWeek))return 'Choose a valid date.';
 if(input.earliestWeek&&!Number.isFinite(Date.parse(input.earliestWeek+'T12:00:00Z')))return 'Choose a valid date.';
 return null;
}
