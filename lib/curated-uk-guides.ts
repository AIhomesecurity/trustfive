export type CuratedUkGuide = {
  id: string;
  category: 'Safety & Compliance' | 'Home Maintenance' | 'Security & Connectivity' | 'Consumer Rights';
  sourceLabel: string;
  title: string;
  summary: string;
  keyTakeaways: string[];
  discussionPrompt: string;
  relatedTradeSlug: string;
  readMinutes: number;
};

/**
 * Curated, public-interest UK home and trade advisories written in clean-room prose
 * summarising well-established official UK standards (ICO, Gas Safe, BS 7671,
 * Building Regulations, Ofcom and Met Office seasonal care). Zero scraped competitor
 * content, zero fabricated reviews, and zero off-platform contact bypass.
 */
export const CURATED_UK_GUIDES: CuratedUkGuide[] = [
  {
    id: 'ico-domestic-cctv-checklist',
    category: 'Security & Connectivity',
    sourceLabel: 'Curated UK Guidance · ICO Domestic CCTV Principles',
    title: 'Domestic CCTV on UK terraces & driveways: privacy zones & polite setup',
    summary:
      'When installing security cameras on British terraces or semi-detached homes, thoughtful angling and digital privacy masking protect neighbour boundaries while keeping clear footage of your own entrance and driveway.',
    keyTakeaways: [
      'Position cameras to capture your own property boundary first; enable privacy masking over neighbouring windows or public footpaths where possible.',
      'Keep clear records if your cameras capture beyond your boundary, and use tidy external conduit with weatherproof junction boxes.',
      'Ask installers to confirm NVR retention settings and hand over full administrator ownership on completion.',
    ],
    discussionPrompt:
      'For neighbours who have fitted CCTV on a UK terrace or semi: how did you angle front-door cameras cleanly while respecting pavement and neighbour privacy?',
    relatedTradeSlug: 'cctv-installation',
    readMinutes: 3,
  },
  {
    id: 'gas-safe-annual-boiler-care',
    category: 'Safety & Compliance',
    sourceLabel: 'Curated UK Guidance · Gas Safe Register Standards',
    title: 'Annual UK gas boiler & carbon monoxide checks before winter peaks',
    summary:
      'Every UK gas boiler, hob and fire should be inspected annually by a Gas Safe registered engineer. Booking before the first cold snap avoids emergency call-out queues and keeps manufacturer warranties valid.',
    keyTakeaways: [
      'Always verify the engineer’s Gas Safe ID card (front and back) for the exact appliance type before work begins.',
      'Test audible carbon monoxide alarms monthly and check boiler pressure sits around 1.0–1.5 bar when cold.',
      'Ask for a written service record and flue gas analyser printout for your home folder.',
    ],
    discussionPrompt:
      'Has anyone booked their annual boiler service early this season? What checks did your engineer include in their written report?',
    relatedTradeSlug: 'boiler-repair',
    readMinutes: 3,
  },
  {
    id: 'bs7671-consumer-unit-rcbo',
    category: 'Safety & Compliance',
    sourceLabel: 'Curated UK Guidance · BS 7671 (18th Edition) Electrical Safety',
    title: 'Upgrading an older fuse box to an all-RCBO metal consumer unit with SPD',
    summary:
      'Modern UK 18th Edition installations use non-combustible metal consumer units with individual RCBO protection and Surge Protection Devices (SPDs) so a single faulty appliance never plunges the whole house into darkness.',
    keyTakeaways: [
      'Check whether your electrician is registered under a UK Competent Person Scheme (NICEIC, NAPIT or ELECSA) to self-certify Part P notifiable work.',
      'Confirm an Electrical Installation Certificate (EIC) and Building Control compliance certificate are included in the written quote.',
      'Ask for earth bonding checks to incoming gas and water services before upgrade day.',
    ],
    discussionPrompt:
      'Thinking of upgrading an older fuse box to an all-RCBO unit with surge protection — how long was your power off on installation day?',
    relatedTradeSlug: 'electrician',
    readMinutes: 4,
  },
  {
    id: 'met-office-storm-roof-gutter-check',
    category: 'Home Maintenance',
    sourceLabel: 'Curated UK Guidance · Seasonal Storm & Roof Care',
    title: '5-minute ground-level roof, ridge tile & gutter check after UK gales',
    summary:
      'Most expensive UK damp repairs start as a single slipped slate, cracked lead flashing or blocked gutter hopper after heavy autumn and winter storms. Spotting issues from ground level saves thousands.',
    keyTakeaways: [
      'Inspect gutters during steady rain from ground level — water cascading over the back edge signals a blocked downpipe or slipped union bracket.',
      'Use binoculars to check chimney flaunching, ridge mortar and lead flashing around bay windows without climbing ladders.',
      'Request dated before-and-after roof photos with every written roofing quote.',
    ],
    discussionPrompt:
      'After the recent wind and heavy rain, has anyone noticed overflowing gutters or slipped ridge tiles around the neighbourhood?',
    relatedTradeSlug: 'roofing',
    readMinutes: 2,
  },
  {
    id: 'dmcc-fair-written-quotes',
    category: 'Consumer Rights',
    sourceLabel: 'Curated UK Guidance · UK Consumer Rights Act 2015',
    title: 'What every fair UK home-improvement written quote should clearly state',
    summary:
      'Comparing written quotes like-for-like protects both homeowners and honest tradespeople. Clear itemised labour, materials, VAT status and payment milestones prevent mid-job surprises.',
    keyTakeaways: [
      'Confirm whether the total is VAT-inclusive or whether the trader is below the UK VAT threshold.',
      'Agree a clear payment milestone schedule (never pay 100% upfront for large domestic works).',
      'Keep all scope changes and snagging notes written inside your TrustFive booking thread.',
    ],
    discussionPrompt:
      'Homeowners and tradespeople: what single detail on a written quote makes comparing two quotes easiest and fairest?',
    relatedTradeSlug: 'handyman',
    readMinutes: 3,
  },
];
