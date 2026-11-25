import {createClient} from '@supabase/supabase-js';

export type Showcase = {
 id: string;
 application_id: string;
 title: string;
 summary: string;
 status: 'pending' | 'published' | 'hidden';
};

export type ShowcaseQuestion = {
 id: string;
 body: string;
 from_business: boolean;
 status: Showcase['status'];
};

export type ShowcaseBusiness = {
 display_name: string;
 description: string | null;
 trade_slug: string;
 area_id: string;
 verified_reviews: {stars: number; body: string | null; date: string}[];
};

export const showcaseFields = 'id,application_id,title,summary,status';
export const questionFields = 'id,body,from_business,status';

export function publicShowcaseClient() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) throw new Error('Public showcase configuration unavailable');
 return createClient(url, key, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
 });
}

export function showcaseJobHref(business: ShowcaseBusiness) {
 return '/jobs?' + new URLSearchParams({trade: business.trade_slug, area: business.area_id});
}

export function showcaseWriteError(error: {code?: string}, fallback: string) {
 if (error.code === '23514') return 'Check the length and remove phone numbers, contact details, full postcodes and external links.';
 if (error.code === 'P0001') return 'The posting limit has been reached. Please try again later.';
 return fallback;
}
