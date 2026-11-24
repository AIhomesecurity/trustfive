export const SOCIAL_SECTIONS = [
  {id: 'neighbourhood', label: 'Feed', description: 'Neighbourhood feed'},
  {id: 'trade', label: 'Groups', description: 'Local groups & Trade Network'},
  {id: 'events', label: 'Events', description: 'Local community events'},
  {id: 'advice', label: 'Advice', description: 'Questions & local advice'},
  {id: 'saved', label: 'Saved', description: 'Your private saved posts'},
] as const;

export type SocialSection = (typeof SOCIAL_SECTIONS)[number]['id'];

export function socialSectionFromQuery(values: readonly string[]): SocialSection {
  if (values.length !== 1) return 'neighbourhood';
  const raw = values[0];
  if (raw === 'groups') return 'trade';
  return SOCIAL_SECTIONS.find(section => section.id === raw)?.id ?? 'neighbourhood';
}

export function socialSectionHref(section: SocialSection): string {
  return section === 'neighbourhood' ? '/community/social' : '/community/social?tab=' + section;
}
