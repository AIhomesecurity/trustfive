export type JobComplexity = 'standard' | 'medium' | 'complex';
export type JobUrgency = 'flexible' | 'this_week' | 'urgent';
export type PropertyType = 'house' | 'flat' | 'commercial' | 'outbuilding';

export type CostGuideJob = {
  id: string;
  title: string;
  summary: string;
  baseLowGbp: number;
  baseHighGbp: number;
  durationLabel: string;
  siteVisitNote: string;
  questions: string[];
};

export type TradeCostGuide = {
  tradeSlug: string;
  tradeLabel: string;
  icon: string;
  categoryNote: string;
  jobs: CostGuideJob[];
};

export const COMPLEXITY_OPTIONS: Array<{value: JobComplexity; label: string; factor: number; hint: string}> = [
  {value: 'standard', label: 'Standard / straightforward', factor: 1, hint: 'Easy access, typical UK home specification'},
  {value: 'medium', label: 'Medium / multi-room', factor: 1.25, hint: 'Additional fixtures, fittings or access prep'},
  {value: 'complex', label: 'Larger / complex access', factor: 1.55, hint: 'Thick masonry, high access, older wiring or bespoke materials'},
];

export const URGENCY_OPTIONS: Array<{value: JobUrgency; label: string; factor: number}> = [
  {value: 'flexible', label: 'Flexible timing (next 2–4 weeks)', factor: 1},
  {value: 'this_week', label: 'Within the next 7 days', factor: 1.08},
  {value: 'urgent', label: 'Urgent / rapid call-out', factor: 1.22},
];

export const PROPERTY_TYPE_OPTIONS: Array<{value: PropertyType; label: string}> = [
  {value: 'house', label: 'House / bungalow'},
  {value: 'flat', label: 'Flat / apartment'},
  {value: 'commercial', label: 'Shop, office or commercial unit'},
  {value: 'outbuilding', label: 'Garage, annex or garden office'},
];

export const UK_COST_GUIDES: TradeCostGuide[] = [
  {
    tradeSlug: 'cctv-installation',
    tradeLabel: 'CCTV & cameras',
    icon: '📹',
    categoryNote: 'Hardwired 4K NVR systems, night colour cameras, smart alerts and discrete external cabling.',
    jobs: [
      {
        id: 'cctv-2-cam',
        title: '2-camera hardwired 4K CCTV installation',
        summary: 'Two weather-rated external cameras wired cleanly back to a local NVR recorder with mobile app viewing.',
        baseLowGbp: 450,
        baseHighGbp: 750,
        durationLabel: 'Half day (3–5 hours)',
        siteVisitNote: 'Check cable route from eaves/loft to router and confirm privacy masking near neighbour boundaries.',
        questions: ['How many external elevations need coverage?', 'Is there loft access above the camera positions?', 'Where is your broadband router located for NVR connection?'],
      },
      {
        id: 'cctv-4-cam',
        title: '4-camera full-perimeter 4K CCTV system',
        summary: 'Four full-colour night-vision cameras with 24/7 local hard-drive recording and zero mandatory cloud fees.',
        baseLowGbp: 790,
        baseHighGbp: 1350,
        durationLabel: 'Full day (6–8 hours)',
        siteVisitNote: 'Confirm ladder access on all sides and whether black/white conduit or hidden routing is preferred.',
        questions: ['Is the property brick, render, stone or pebbledash?', 'Do you need ANPR / driveway entry alerts?', 'Any garage or outbuilding cameras required?'],
      },
      {
        id: 'cctv-fault-upgrade',
        title: 'CCTV fault repair or NVR upgrade',
        summary: 'Diagnose offline cameras, replace failed power supplies/hard drives or upgrade legacy coaxial cameras.',
        baseLowGbp: 140,
        baseHighGbp: 340,
        durationLabel: '1–3 hours',
        siteVisitNote: 'Share existing recorder brand and fault symptoms so the engineer brings matching connectors.',
        questions: ['What brand/model is your current recorder?', 'Are all cameras offline or just one?', 'Can you still access the recorder locally on a monitor?'],
      },
    ],
  },
  {
    tradeSlug: 'home-security',
    tradeLabel: 'Home security',
    icon: '🔒',
    categoryNote: 'Wireless Grade-2 intruder alarms, smart locks, security lighting and door/window perimeter protection.',
    jobs: [
      {
        id: 'alarm-wireless',
        title: 'Smart wireless intruder alarm installation',
        summary: 'Hub, external bellbox, door contacts, pet-friendly PIR motion sensors and smartphone alert setup.',
        baseLowGbp: 550,
        baseHighGbp: 950,
        durationLabel: 'Half day (3–5 hours)',
        siteVisitNote: 'Confirm whether pets roam downstairs and if an external live siren box is required at first-floor height.',
        questions: ['How many external doors and ground-floor rooms need sensors?', 'Do you have indoor pets?', 'Do you want keyfobs, keypad or smartphone app control?'],
      },
      {
        id: 'lock-upgrade',
        title: 'Anti-snap euro cylinder & multipoint lock upgrade',
        summary: 'Replace worn or vulnerable UPVC/composite door cylinders with British Standard 3-star anti-snap locks.',
        baseLowGbp: 130,
        baseHighGbp: 290,
        durationLabel: '1–2 hours',
        siteVisitNote: 'Measure door type (UPVC, composite or timber) and note if the handle feels stiff when lifting.',
        questions: ['How many doors need lock upgrades?', 'Are the doors UPVC, composite or timber?', 'Do you want keyed-alike cylinders across front and back doors?'],
      },
      {
        id: 'security-lighting',
        title: 'PIR LED security floodlight installation',
        summary: 'Supply and fit weatherproof motion-activated external LED floodlights wired safely to an interior spur.',
        baseLowGbp: 160,
        baseHighGbp: 340,
        durationLabel: '2–3 hours',
        siteVisitNote: 'Check nearest internal power feed and confirm sensor positioning avoids triggering on footpaths.',
        questions: ['How many floodlights are needed?', 'Is there an existing external light feed to reuse?', 'Is the mounting point above ground-floor height?'],
      },
    ],
  },
  {
    tradeSlug: 'plumbing',
    tradeLabel: 'Plumbing',
    icon: '🔧',
    categoryNote: 'Leaks, taps, toilets, unvented cylinders, outdoor taps and emergency pipework repairs.',
    jobs: [
      {
        id: 'plumb-leak',
        title: 'Pipe leak trace & repair',
        summary: 'Locate and repair leaking supply pipe, radiator valve or waste trap under sinks, baths or floorboards.',
        baseLowGbp: 110,
        baseHighGbp: 260,
        durationLabel: '1–3 hours',
        siteVisitNote: 'Confirm where your internal stopcock is located and whether the leak is visible or behind boxing.',
        questions: ['Is the leak constant or only when taps/appliances run?', 'Can you access the pipework without removing tiles?', 'Where is the main stopcock located?'],
      },
      {
        id: 'plumb-tap-toilet',
        title: 'Tap, cistern or toilet valve replacement',
        summary: 'Replace dripping kitchen/bathroom mixer taps or fix continuously running toilet cisterns.',
        baseLowGbp: 95,
        baseHighGbp: 220,
        durationLabel: '1–2 hours',
        siteVisitNote: 'Let the plumber know if you are supplying the new tap or want the trade to supply parts.',
        questions: ['Are you supplying the replacement tap/parts?', 'Is there an isolation valve underneath?', 'Is it a standard or concealed cistern?'],
      },
      {
        id: 'plumb-outside-tap',
        title: 'Outdoor bib tap installation (with double check valve)',
        summary: 'Core-drill through external wall and fit insulated compliant garden tap with internal isolation valve.',
        baseLowGbp: 120,
        baseHighGbp: 230,
        durationLabel: '1–2 hours',
        siteVisitNote: 'Confirm proximity to an internal cold water supply such as a kitchen sink or utility room.',
        questions: ['Is there a cold water pipe directly inside the chosen wall?', 'What is the external wall construction (brick/stone/render)?', 'Do you need hot and cold or cold only?'],
      },
    ],
  },
  {
    tradeSlug: 'electrical',
    tradeLabel: 'Electrical',
    icon: '⚡',
    categoryNote: 'Consumer units, EICR certificates, sockets, EV chargers, lighting circuits and fault finding.',
    jobs: [
      {
        id: 'elec-cu',
        title: 'Consumer unit (fuseboard) upgrade with RCBOs & SPD',
        summary: 'Replace an older fusebox with a current 18th Edition metal consumer unit, full circuit testing and Part P notification.',
        baseLowGbp: 550,
        baseHighGbp: 950,
        durationLabel: 'Full day (5–7 hours)',
        siteVisitNote: 'Share a photo of the existing board and count the number of circuits (typically 6–12 ways).',
        questions: ['How many circuits are on your existing consumer unit?', 'Are you aware of any tripping faults today?', 'Is the meter and board easily accessible?'],
      },
      {
        id: 'elec-eicr',
        title: 'Electrical Installation Condition Report (EICR)',
        summary: 'Full inspection and testing of fixed wiring for homeowners, buyers or UK landlords.',
        baseLowGbp: 160,
        baseHighGbp: 300,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Power will be isolated briefly during dead testing; advise if home-office equipment must be shut down safely.',
        questions: ['How many bedrooms and consumer units does the property have?', 'Is this for a landlord compliance renewal or home purchase?', 'Are there any outbuildings with sub-mains?'],
      },
      {
        id: 'elec-sockets-lights',
        title: 'Add double sockets or LED downlights',
        summary: 'Extend ring/radial circuits, chase plaster walls or fit fire-rated LED downlights.',
        baseLowGbp: 140,
        baseHighGbp: 380,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Clarify whether walls are solid brick or stud plasterboard and if making-good plaster is needed.',
        questions: ['How many sockets or light points are needed?', 'Are the walls solid brick or stud plasterboard?', 'Is there loft or floorboard access above?'],
      },
    ],
  },
  {
    tradeSlug: 'heating',
    tradeLabel: 'Heating & boilers',
    icon: '🔥',
    categoryNote: 'Gas Safe boiler servicing, combi replacements, smart thermostats, radiator installs and powerflushing.',
    jobs: [
      {
        id: 'heat-service',
        title: 'Annual Gas Safe boiler service & safety check',
        summary: 'Full combustion analysis, seal and pressure checks, condensate inspection and service record.',
        baseLowGbp: 80,
        baseHighGbp: 135,
        durationLabel: '45–90 minutes',
        siteVisitNote: 'Always verify the engineer’s Gas Safe Register ID card on arrival.',
        questions: ['What make and approximate age is the boiler?', 'Is it a combi, system or regular heat-only boiler?', 'Are you also requesting a Landlord Gas Safety Certificate (CP12)?'],
      },
      {
        id: 'heat-combi-swap',
        title: 'Like-for-like combi boiler replacement',
        summary: 'Remove old boiler, flush system, fit new A-rated condensing combi with magnetic filter and smart thermostat.',
        baseLowGbp: 2100,
        baseHighGbp: 3400,
        durationLabel: '1–2 days',
        siteVisitNote: 'Requires a brief pre-install survey to verify gas pipe sizing, flue route and condensate drain.',
        questions: ['Is the new boiler staying in the same location?', 'How many radiators and bathrooms does the home have?', 'Do you need a horizontal wall flue or vertical roof flue?'],
      },
      {
        id: 'heat-radiator',
        title: 'Radiator replacement or smart thermostat install',
        summary: 'Swap an older radiator for a modern double-panel/designer unit or wire a smart heating controller.',
        baseLowGbp: 150,
        baseHighGbp: 340,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Confirm pipe centres and whether valves (TRVs) are also being replaced.',
        questions: ['Are you supplying the radiator or thermostat?', 'Does pipework need altering to match the new width?', 'Are all other radiators heating evenly?'],
      },
    ],
  },
  {
    tradeSlug: 'roofing',
    tradeLabel: 'Roofing',
    icon: '🏠',
    categoryNote: 'Slipped tiles, chimney repointing, lead flashing, flat roofs and roofline guttering.',
    jobs: [
      {
        id: 'roof-repair',
        title: 'Slipped tile, ridge or lead flashing repair',
        summary: 'Replace broken slates/tiles, re-bed loose ridge tiles or re-dress leaking chimney lead flashing.',
        baseLowGbp: 220,
        baseHighGbp: 580,
        durationLabel: '2–5 hours',
        siteVisitNote: 'Higher 3-storey eaves or steep pitches may require a scaffold tower for safe access.',
        questions: ['Are the tiles concrete, clay or natural slate?', 'Is water currently entering the loft or ceiling?', 'Is the property 2-storey or 3-storey?'],
      },
      {
        id: 'roof-gutter',
        title: 'Gutter & fascia repair or full replacement',
        summary: 'Fix leaking joints, replace cracked downpipes or renew UPVC fascias, soffits and guttering.',
        baseLowGbp: 160,
        baseHighGbp: 950,
        durationLabel: '2 hours – 2 days',
        siteVisitNote: 'State whether the work covers front elevation only or full wrap-around roofline.',
        questions: ['Is it a repair to one joint or full replacement?', 'Are there conservatories or extensions blocking ladder access?', 'What colour profile do you want (black, white, anthracite)?'],
      },
      {
        id: 'roof-flat',
        title: 'Garage or extension flat roof renewal (EPDM / GRP)',
        summary: 'Strip perished felt, inspect decking boards and install long-life EPDM rubber or fibreglass roof.',
        baseLowGbp: 1250,
        baseHighGbp: 2800,
        durationLabel: '1–2 days',
        siteVisitNote: 'Give rough dimensions (length × width in metres) for a tighter estimate.',
        questions: ['Roughly how many square metres is the flat roof?', 'Are the timber decking boards still solid?', 'Does the roof have skylights or parapet walls?'],
      },
    ],
  },
  {
    tradeSlug: 'cleaning',
    tradeLabel: 'Cleaning',
    icon: '🧼',
    categoryNote: 'End-of-tenancy deep cleans, regular domestic cleans, oven and carpet cleaning.',
    jobs: [
      {
        id: 'clean-eot',
        title: 'End-of-tenancy full property deep clean',
        summary: 'Inventory-standard clean covering kitchen, oven, bathrooms, skirting, internal windows and floors.',
        baseLowGbp: 180,
        baseHighGbp: 420,
        durationLabel: '4–7 hours',
        siteVisitNote: 'Confirm whether the property will be completely empty of furniture and if carpets need hot-water extraction.',
        questions: ['How many bedrooms and bathrooms?', 'Will the property be unfurnished on the day?', 'Do you need oven or carpet steam cleaning included?'],
      },
      {
        id: 'clean-deep',
        title: 'One-off home spring / deep clean',
        summary: 'Thorough top-to-bottom refresh for kitchens, bathrooms, woodwork and living spaces.',
        baseLowGbp: 120,
        baseHighGbp: 280,
        durationLabel: '3–5 hours',
        siteVisitNote: 'Mention any pets, delicate stone surfaces or specific priority rooms.',
        questions: ['Which rooms are top priority?', 'Are cleaning materials provided by the cleaner?', 'Is parking available outside?'],
      },
    ],
  },
  {
    tradeSlug: 'handyman',
    tradeLabel: 'Handyman',
    icon: '🛠️',
    categoryNote: 'TV wall mounting, shelving, blinds, door easing, resealing and odd-job punch lists.',
    jobs: [
      {
        id: 'handy-tv-mount',
        title: 'TV wall mounting & cable concealment',
        summary: 'Securely mount flat-screen TV on brick, dot-and-dab or stud walls with level alignment and tidy cabling.',
        baseLowGbp: 90,
        baseHighGbp: 220,
        durationLabel: '1–2 hours',
        siteVisitNote: 'State TV screen size, bracket type (flat/tilt/full-motion) and wall construction.',
        questions: ['What screen size is the TV and do you already have the bracket?', 'Is the wall solid brick, dot-and-dab plasterboard or hollow stud?', 'Are there power sockets near the mounting position?'],
      },
      {
        id: 'handy-half-day',
        title: 'Half-day odd-jobs punch list',
        summary: 'Group small home repairs together — shelves, curtain poles, resealing baths, door latches and mirrors.',
        baseLowGbp: 130,
        baseHighGbp: 240,
        durationLabel: '3–4 hours',
        siteVisitNote: 'List every task upfront so the handyman brings the exact wall fixings and sealants.',
        questions: ['How many separate small tasks are on your list?', 'Will you supply fixtures (blinds, shelves, handles)?', 'Are any walls tiled or dot-and-dab?'],
      },
    ],
  },
  {
    tradeSlug: 'painting',
    tradeLabel: 'Painting',
    icon: '🎨',
    categoryNote: 'Interior rooms, hall/stairs/landing, woodwork glossing, wallpapering and exterior masonry.',
    jobs: [
      {
        id: 'paint-room',
        title: 'Single bedroom or living room full repaint',
        summary: 'Prep and fill minor cracks, two coats on ceiling and walls, plus skirting and door frame woodwork.',
        baseLowGbp: 320,
        baseHighGbp: 620,
        durationLabel: '1–2 days',
        siteVisitNote: 'Specify whether paint is included and if rooms will be cleared of large furniture.',
        questions: ['Rough room dimensions and ceiling height?', 'Are you painting over a dark colour or wallpaper?', 'Should woodwork and ceiling be included?'],
      },
      {
        id: 'paint-hsl',
        title: 'Hall, stairs & landing decorating',
        summary: 'Safe stairwell access prep, ceiling/wall emulsion coats, banisters, spindles and doors.',
        baseLowGbp: 580,
        baseHighGbp: 1150,
        durationLabel: '2–4 days',
        siteVisitNote: 'Mention number of doors and whether spindles are painted or varnished timber.',
        questions: ['How many storeys/flights of stairs?', 'How many internal doors and frames?', 'Do any walls need lining paper first?'],
      },
    ],
  },
  {
    tradeSlug: 'gardening',
    tradeLabel: 'Gardening',
    icon: '🌿',
    categoryNote: 'Hedge trimming, lawn care, garden clearance, pruning and seasonal maintenance.',
    jobs: [
      {
        id: 'garden-clearance',
        title: 'Overgrown garden clearance & green waste removal',
        summary: 'Cut back brambles, strim lawns, trim hedges and remove green waste responsibly.',
        baseLowGbp: 180,
        baseHighGbp: 480,
        durationLabel: 'Half to full day',
        siteVisitNote: 'Confirm side-gate access width and whether green waste is taken away or binned on-site.',
        questions: ['Rough garden size (small terrace, medium semi, large)?', 'Is there side/rear access without going through the house?', 'Do you need green waste taken away?'],
      },
      {
        id: 'garden-hedge',
        title: 'Hedge cutting & shaping',
        summary: 'Trim, level and tidy boundary hedges with full leaf and clipping clean-up.',
        baseLowGbp: 110,
        baseHighGbp: 290,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Note approximate length and height of the hedge.',
        questions: ['How long and tall is the hedge roughly?', 'Is access clear on both sides?', 'Are there overhead cables nearby?'],
      },
    ],
  },
  {
    tradeSlug: 'moving',
    tradeLabel: 'Moving',
    icon: '🚚',
    categoryNote: 'Local house moves, man-and-van transport, student moves and single bulky item delivery.',
    jobs: [
      {
        id: 'move-local-2bed',
        title: 'Local 2-bedroom home removal (2 movers + Luton van)',
        summary: 'Blanket-wrapped loading, transit and unloading between local addresses.',
        baseLowGbp: 350,
        baseHighGbp: 680,
        durationLabel: 'Half to full day',
        siteVisitNote: 'Confirm stairs/lift access, parking restrictions and distance between postcodes.',
        questions: ['How many bedrooms and any heavy items (piano, American fridge)?', 'Are either properties above ground floor without a lift?', 'Will boxes be packed ready before arrival?'],
      },
      {
        id: 'move-van',
        title: 'Man-and-van single load or bulky item transport',
        summary: 'Collect and deliver sofas, appliances or part-loads locally.',
        baseLowGbp: 90,
        baseHighGbp: 220,
        durationLabel: '1–3 hours',
        siteVisitNote: 'Provide collection and drop-off outward postcodes and item dimensions.',
        questions: ['Do you need 1 mover or 2 movers?', 'Will items fit through doorways without disassembly?', 'Are there loading restrictions or stairs?'],
      },
    ],
  },
  {
    tradeSlug: 'furniture-assembly',
    tradeLabel: 'Furniture assembly',
    icon: '🪑',
    categoryNote: 'Flat-pack wardrobes, beds, office desks, wall anchoring and garden playsets.',
    jobs: [
      {
        id: 'furn-wardrobe',
        title: 'Flat-pack sliding/hinged wardrobe assembly',
        summary: 'Assemble multi-door wardrobe cleanly, adjust door hinges and anchor safely to wall.',
        baseLowGbp: 110,
        baseHighGbp: 260,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Check ceiling clearance height (sliding wardrobes often need upright build space).',
        questions: ['What retailer/range (e.g. IKEA PAX, Argos) and width?', 'Is the room clear enough to assemble flat?', 'Should the unit be anchored into the wall?'],
      },
      {
        id: 'furn-bundle',
        title: 'Multi-item bedroom or home-office assembly',
        summary: 'Build bed frame, chest of drawers, desk and chairs in one booked visit.',
        baseLowGbp: 120,
        baseHighGbp: 290,
        durationLabel: '2–5 hours',
        siteVisitNote: 'Confirm boxes are already in the target room.',
        questions: ['How many items need assembling?', 'Are all boxes unopened in the target room?', 'Do you need packaging flattened for recycling?'],
      },
    ],
  },
  {
    tradeSlug: 'carpentry',
    tradeLabel: 'Carpentry',
    icon: '🪚',
    categoryNote: 'Internal doors, skirting boards, bespoke alcoves, staircases and decking.',
    jobs: [
      {
        id: 'carp-doors',
        title: 'Hang internal doors (2–4 doors with ironmongery)',
        summary: 'Trim, hinge, fit latches/handles and plane doors for clean swing over existing flooring.',
        baseLowGbp: 180,
        baseHighGbp: 420,
        durationLabel: 'Half to full day',
        siteVisitNote: 'State whether doors are hollow-core, solid oak or fire-rated FD30.',
        questions: ['How many doors and are they solid or hollow core?', 'Are you supplying doors, hinges and handles?', 'Do existing frames sit reasonably square?'],
      },
      {
        id: 'carp-alcove',
        title: 'Bespoke alcove shelving & storage cabinet',
        summary: 'Measure, scribe to uneven walls and build made-to-measure alcove cupboard with floating shelves.',
        baseLowGbp: 550,
        baseHighGbp: 1350,
        durationLabel: '1–3 days',
        siteVisitNote: 'Confirm primed MDF vs solid timber finish and whether painting is included.',
        questions: ['How many alcoves and rough width?', 'Cupboard base + shelves or shelves only?', 'Do you need cable cutouts for TV/router?'],
      },
    ],
  },
  {
    tradeSlug: 'flooring',
    tradeLabel: 'Flooring',
    icon: '🧱',
    categoryNote: 'LVT click/glue-down, engineered wood, laminate, subfloor levelling and carpets.',
    jobs: [
      {
        id: 'floor-laminate-lvt',
        title: 'Fit laminate or click LVT flooring (approx. 20m²)',
        summary: 'Lay underlay, fit click flooring with expansion gaps, door bars and scotia/beading.',
        baseLowGbp: 340,
        baseHighGbp: 680,
        durationLabel: '1 day',
        siteVisitNote: 'Confirm whether old flooring needs uplifting and if concrete/timber subfloor is level.',
        questions: ['Rough floor area in square metres?', 'Is the subfloor concrete or timber floorboards?', 'Are you supplying the flooring and underlay?'],
      },
      {
        id: 'floor-level',
        title: 'Subfloor ply-boarding or latex self-levelling',
        summary: 'Prepare uneven floors cleanly before fitting glue-down LVT or vinyl.',
        baseLowGbp: 260,
        baseHighGbp: 620,
        durationLabel: 'Half to full day',
        siteVisitNote: 'Allow drying cure time before final floor laying.',
        questions: ['What is the current subfloor type?', 'Are there damp spots or creaking boards?', 'What final flooring will go on top?'],
      },
    ],
  },
  {
    tradeSlug: 'drainage',
    tradeLabel: 'Drainage',
    icon: '💧',
    categoryNote: 'Blocked drains, high-pressure jetting, CCTV drain surveys and gully repairs.',
    jobs: [
      {
        id: 'drain-unblock',
        title: 'Blocked external drain or toilet clearance (rodding / jetting)',
        summary: 'Clear stubborn fat, root or silt blockages and restore full flow.',
        baseLowGbp: 110,
        baseHighGbp: 260,
        durationLabel: '1–2 hours',
        siteVisitNote: 'Note whether manhole/inspection chamber covers are accessible in the driveway or garden.',
        questions: ['Is one fixture affected or multiple drains backing up?', 'Do you know where the inspection manhole cover is?', 'Has this drain blocked repeatedly before?'],
      },
      {
        id: 'drain-cctv',
        title: 'CCTV drain camera inspection & written report',
        summary: 'Camera survey to locate cracks, root ingress or displaced joints (ideal for homebuyers or recurring blockages).',
        baseLowGbp: 180,
        baseHighGbp: 360,
        durationLabel: '1–2 hours',
        siteVisitNote: 'Confirm if a formal written report + video recording is needed for a surveyor or insurer.',
        questions: ['Is this for a house purchase survey or recurring blockage?', 'How many inspection chambers are accessible?', 'Do you need a formal PDF report?'],
      },
    ],
  },
  {
    tradeSlug: 'plastering',
    tradeLabel: 'Plastering',
    icon: '🏗️',
    categoryNote: 'Skimming rooms, covering Artex ceilings, patch repairs, boarding and external rendering.',
    jobs: [
      {
        id: 'plaster-room',
        title: 'Reskim single bedroom or lounge (walls & ceiling)',
        summary: 'PVA/bonding prep and two-coat multi-finish gypsum skim ready for mist-coat painting.',
        baseLowGbp: 450,
        baseHighGbp: 850,
        durationLabel: '1–2 days',
        siteVisitNote: 'Mention any loose blown plaster, Artex texture or exposed chases needing bonding first.',
        questions: ['Rough room size and whether ceiling is included?', 'Is there Artex or loose plaster that needs removing/overboarding?', 'Will the room be empty of furniture and carpets protected?'],
      },
      {
        id: 'plaster-patch',
        title: 'Patch plastering after rewiring or leak repair',
        summary: 'Make good electrical chases, ceiling cutouts or damp patch repairs.',
        baseLowGbp: 150,
        baseHighGbp: 340,
        durationLabel: '2–4 hours',
        siteVisitNote: 'Ensure any underlying plumbing/roof leak is fixed and fully dry before skimming.',
        questions: ['How many patches or ceiling holes?', 'Does plasterboard need replacing first?', 'Has the cause of any leak been resolved?'],
      },
    ],
  },
  {
    tradeSlug: 'bathrooms',
    tradeLabel: 'Bathrooms',
    icon: '🚿',
    categoryNote: 'Full bathroom refurbishments, shower enclosures, wet rooms, tiling and vanity fitting.',
    jobs: [
      {
        id: 'bath-suite',
        title: 'Full standard bathroom rip-out & installation (labour)',
        summary: 'Remove old suite, first-fix plumbing, tank shower zone, tile walls/floor and fit new suite.',
        baseLowGbp: 2800,
        baseHighGbp: 5500,
        durationLabel: '5–8 days',
        siteVisitNote: 'Indicative labour guide; suite, tiles and electrical fan/lighting priced according to specification.',
        questions: ['Are fixtures staying in the same layout or moving?', 'Full-height tiling or shower area only?', 'Are you supplying the suite and tiles?'],
      },
      {
        id: 'bath-shower',
        title: 'Replace shower tray, enclosure & mixer valve',
        summary: 'Upgrade leaking shower cubicle with new resin tray, glass screen, resealing and mixer.',
        baseLowGbp: 480,
        baseHighGbp: 1150,
        durationLabel: '1–2 days',
        siteVisitNote: 'Check if surrounding wall tiles will need making good or shower panels installed.',
        questions: ['Is it an electric shower or thermostatic mixer?', 'Will wall tiles need replacing around the enclosure?', 'Is the floor timber or concrete?'],
      },
    ],
  },
  {
    tradeSlug: 'kitchens',
    tradeLabel: 'Kitchens',
    icon: '🍽️',
    categoryNote: 'Dry-fit kitchen installation, worktop mitring, splashbacks and appliance integration.',
    jobs: [
      {
        id: 'kitchen-dryfit',
        title: 'Standard kitchen installation (dry fit — 8–12 units)',
        summary: 'Assemble and level base/wall units, mitre laminate worktops, cut sink/hob apertures and fit trims.',
        baseLowGbp: 1800,
        baseHighGbp: 3600,
        durationLabel: '3–5 days',
        siteVisitNote: 'Gas hob connections and new electrical circuits must be signed off by Gas Safe / Part P qualified trades.',
        questions: ['How many units and which supplier (flat-pack or rigid)?', 'Laminate, solid wood or quartz worktops?', 'Do plumbing, gas or electrics need relocating?'],
      },
      {
        id: 'kitchen-worktop',
        title: 'Worktop replacement & sink/hob refit',
        summary: 'Remove old worktops, mason-mitre new lengths and reconnect sink/tap cleanly.',
        baseLowGbp: 380,
        baseHighGbp: 820,
        durationLabel: '1 day',
        siteVisitNote: 'Confirm number of corner joints and whether splashbacks or upstands are included.',
        questions: ['How many worktop lengths and corner joints?', 'Are you supplying the worktops?', 'Is the hob gas or electric?'],
      },
    ],
  },
  {
    tradeSlug: 'windows',
    tradeLabel: 'Windows & doors',
    icon: '🪟',
    categoryNote: 'Misted double-glazing units, UPVC/composite doors, window hinges and full replacements.',
    jobs: [
      {
        id: 'win-misted',
        title: 'Replace misted / blown double-glazed glass units (2–4 panes)',
        summary: 'Swap failed foggy sealed glass panes while retaining your existing UPVC or aluminium frames.',
        baseLowGbp: 190,
        baseHighGbp: 460,
        durationLabel: '1–2 hours (after measure)',
        siteVisitNote: 'Requires a brief measure visit so custom toughened/low-E sealed units can be manufactured.',
        questions: ['How many glass panes are misted?', 'Are any on first floor or above?', 'Do the panes have leaded patterns or Georgian bars?'],
      },
      {
        id: 'win-composite-door',
        title: 'Supply & fit composite front door (FENSA / Certass)',
        summary: 'Measure, remove old door/frame and install thermally efficient multi-point locked composite entrance door.',
        baseLowGbp: 1150,
        baseHighGbp: 1950,
        durationLabel: 'Half day (3–5 hours)',
        siteVisitNote: 'Confirm sidelights/fanlights and check that building-regulations registration certificate is provided.',
        questions: ['Single door or door with glass side panel?', 'Standard colour or bespoke glazing style?', 'Do you want upgraded 3-star anti-snap cylinder?'],
      },
    ],
  },
  {
    tradeSlug: 'landscaping',
    tradeLabel: 'Landscaping',
    icon: '🌳',
    categoryNote: 'Porcelain & Indian sandstone patios, timber fencing, sleepers, turfing and driveways.',
    jobs: [
      {
        id: 'land-patio',
        title: 'New patio installation (approx. 20m² sandstone / porcelain)',
        summary: 'Excavate, lay compacted Type-1 MOT sub-base, full mortar bed paving and weather-resistant pointing.',
        baseLowGbp: 2400,
        baseHighGbp: 4600,
        durationLabel: '3–5 days',
        siteVisitNote: 'Confirm drainage falls away from house damp-proof course and skip/barrowing access.',
        questions: ['Rough patio area in square metres?', 'Indian sandstone, porcelain or concrete slabs?', 'Is there clear side access for materials and spoil removal?'],
      },
      {
        id: 'land-fence',
        title: 'Garden fence panel & concrete post replacement (5–8 bays)',
        summary: 'Remove damaged panels/posts, set slotted concrete posts & gravel boards, fit heavy-duty feather-edge panels.',
        baseLowGbp: 750,
        baseHighGbp: 1650,
        durationLabel: '1–2 days',
        siteVisitNote: 'Check boundary ownership and confirm any tree roots or retaining walls along the fence line.',
        questions: ['How many 6ft fence bays need replacing?', 'Timber posts or concrete posts + gravel boards?', 'Are there shrubs or concrete footings to clear?'],
      },
    ],
  },
];

export function findTradeCostGuide(tradeSlug: string): TradeCostGuide {
  return UK_COST_GUIDES.find((g) => g.tradeSlug === tradeSlug) ?? UK_COST_GUIDES[0];
}

export function calculateEstimate(input: {
  job: CostGuideJob;
  complexity: JobComplexity;
  urgency: JobUrgency;
}) {
  const cFactor = COMPLEXITY_OPTIONS.find((c) => c.value === input.complexity)?.factor ?? 1;
  const uFactor = URGENCY_OPTIONS.find((u) => u.value === input.urgency)?.factor ?? 1;
  const multiplier = cFactor * uFactor;
  const roundTo5 = (n: number) => Math.max(50, Math.round((n * multiplier) / 5) * 5);
  const lowGbp = roundTo5(input.job.baseLowGbp);
  const highGbp = Math.max(lowGbp + 20, roundTo5(input.job.baseHighGbp));
  const midGbp = Math.round((lowGbp + highGbp) / 2 / 5) * 5;
  return {
    lowGbp,
    highGbp,
    midGbp,
    durationLabel: input.job.durationLabel,
    note: 'Indicative UK market guide range only — not a binding quote. Approved local TrustFive professionals provide their own written quotes after reviewing your job brief.',
  };
}

export function buildJobsPrefillHref(input: {
  tradeSlug: string;
  jobTitle: string;
  midGbp: number;
  urgency: JobUrgency;
  propertyType: PropertyType;
  siteNotes?: string;
}): string {
  const params = new URLSearchParams();
  params.set('trade', input.tradeSlug);
  params.set('title', input.jobTitle.slice(0, 110));
  if (Number.isFinite(input.midGbp) && input.midGbp > 0) {
    params.set('budget', String(Math.round(input.midGbp)));
  }
  const urgencyLabel = URGENCY_OPTIONS.find((u) => u.value === input.urgency)?.label ?? 'Flexible';
  const propertyLabel = PROPERTY_TYPE_OPTIONS.find((p) => p.value === input.propertyType)?.label ?? 'House';
  const parts = [
    `Property type: ${propertyLabel}.`,
    `Preferred timing: ${urgencyLabel}.`,
    input.siteNotes?.trim() ? `Key details: ${input.siteNotes.trim()}` : '',
  ].filter(Boolean);
  params.set('brief', parts.join(' ').slice(0, 600));
  return `/jobs?${params.toString()}`;
}

export function parseJobsPrefillParams(search: string): {
  trade: string;
  title: string;
  budget: string;
  brief: string;
} {
  const params = new URLSearchParams(search);
  const clean = (value: string | null, max: number) =>
    (value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const rawBudget = clean(params.get('budget'), 10);
  const budget = /^\d+(?:\.\d{1,2})?$/.test(rawBudget) ? rawBudget : '';
  return {
    trade: clean(params.get('trade'), 64).toLowerCase(),
    title: clean(params.get('title'), 110),
    budget,
    brief: clean(params.get('brief'), 600),
  };
}
