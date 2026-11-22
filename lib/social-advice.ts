/** Questions use an explicit, recognisable text heading until dedicated typed RLS exists. */
export const SOCIAL_ADVICE_TOPICS=['CCTV & security','Plumbing','Electrical','Roofing','Heating','Building','Gardening','Decorating','General home maintenance'] as const;
export type SocialAdviceTopic=typeof SOCIAL_ADVICE_TOPICS[number];

export function isSocialAdviceTopic(value:string):value is SocialAdviceTopic{
 return (SOCIAL_ADVICE_TOPICS as readonly string[]).includes(value);
}
export function socialQuestionBody(topic:string,question:string):string|null{
 if(!isSocialAdviceTopic(topic))return null;
 const text=question.trim();
 const body='Question about '+topic+': '+text;
 if(text.length<8||body.length>3000)return null;
 return body;
}
export function socialQuestionSearchPattern(topic:string):string|null{
 if(topic===''||topic==='all')return 'Question about %:%';
 if(!isSocialAdviceTopic(topic))return null;
 return 'Question about '+topic+':%';
}
