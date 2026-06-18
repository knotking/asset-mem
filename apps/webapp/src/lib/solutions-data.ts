/** Copy for /solutions marketing pages — shipped capabilities only. */

export type SolutionSlug =
  | 'property-managers'
  | 'insurance'
  | 'field-teams'
  | 'platform';

export type SolutionWorkflow = {
  title: string;
  description: string;
  steps: readonly string[];
};

export type SolutionPageData = {
  slug: SolutionSlug;
  path: `/solutions/${SolutionSlug}`;
  title: string;
  headline: string;
  accent: string;
  problem: string;
  bullets: readonly string[];
  workflows: readonly SolutionWorkflow[];
  analyticsLabel: string;
  keywords: readonly string[];
};

/** Shown on segment detail pages only — introduces the in-product term once. */
export const SOLUTION_PRODUCT_TERM_NOTE =
  'In AssetMem, each walkthrough or inspection is saved as a checkpoint—a timestamped condition capture with AI scoring on your property timeline.';

export const SOLUTION_PAGES: Record<SolutionSlug, SolutionPageData> = {
  'property-managers': {
    slug: 'property-managers',
    path: '/solutions/property-managers',
    title: 'Property managers, rental companies & hospitality',
    headline: 'Portfolio inspections',
    accent: 'without spreadsheet chaos',
    problem:
      'Rental companies, Airbnb hosts, hotel chains, and property managers need consistent photo evidence for turnovers, routine walkthroughs, and maintenance triage—without adding headcount.',
    bullets: [
      'Standardized walkthroughs per unit with AI condition scores',
      'Move-in / move-out reports with before/after comparisons',
      'Document intelligence on leases, inspections, and vendor notes',
      'Share read-only report links with owners and contractors',
    ],
    workflows: [
      {
        title: 'Guest turnover (Airbnb, hotels, rentals)',
        description: 'Document condition between guest stays to catch damage fast',
        steps: [
          'Capture photos after each guest checkout with mobile app',
          'AI flags new damage, wear patterns, or missing items',
          'Compare current state to baseline or previous guest checkout',
          'Generate report for housekeeping, maintenance, or guest charges',
        ],
      },
      {
        title: 'Quarterly maintenance checks',
        description: 'Track condition changes across your portfolio over time',
        steps: [
          'Schedule quarterly walkthroughs with structured photo capture per unit',
          'Platform compares new photos to previous visits automatically',
          'Review flagged issues (moisture trends, wear patterns, damage)',
          'Prioritize maintenance tasks based on AI condition scores',
        ],
      },
      {
        title: 'Move-out comparison',
        description: 'Document damage and justify deposit deductions with proof',
        steps: [
          'Capture move-out photos using the same room-by-room structure',
          'Generate before/after comparison report showing what changed',
          'Review side-by-side photos with tenant to resolve disputes',
          'Keep timestamped evidence for your records and owner reporting',
        ],
      },
    ],
    analyticsLabel: 'solutions_pm',
    keywords: [
      'property management inspection software',
      'rental turnover documentation',
      'portfolio maintenance AI',
    ],
  },
  insurance: {
    slug: 'insurance',
    path: '/solutions/insurance',
    title: 'Insurance & adjusters',
    headline: 'Claims evidence',
    accent: 'that holds up in review',
    problem:
      'Adjusters and policyholders need timestamped photos, structured condition metrics, and formal reports—not camera rolls scattered across email.',
    bullets: [
      'AI-assisted insurance reports with photos and change highlights',
      'Timeline of condition evidence across a property',
      'AI summaries grounded in captured media and documents',
      'Shareable links for carriers, adjusters, or counsel',
    ],
    workflows: [
      {
        title: 'Storm damage documentation',
        description: 'Capture before/after evidence for weather-related claims',
        steps: [
          'Policyholder captures pre-storm baseline photos (roof, exterior, yard)',
          'After event, capture damage photos using the same area-by-area structure',
          'AI detects claim-relevant changes: missing shingles, water intrusion, structural damage',
          'Generate formal report with before/after comparisons and share with adjuster',
        ],
      },
      {
        title: 'Claims intake for adjusters',
        description: 'Review policyholder evidence and validate damage claims',
        steps: [
          'Policyholder shares read-only report link',
          'Review timestamped photos, AI condition scores, and AI-generated change highlights',
          'Ask follow-up questions via chat on specific damage areas',
          'Accept or request additional photos without back-and-forth emails',
        ],
      },
      {
        title: 'Ongoing property monitoring',
        description: 'Track insured properties over time to catch risks early',
        steps: [
          'Policyholder captures routine inspections (quarterly, seasonal, annual)',
          'Platform flags condition score drops and emerging issues',
          'Review trends: moisture patterns, roof deterioration, HVAC aging',
          'Proactive outreach before small issues become major claims',
        ],
      },
    ],
    analyticsLabel: 'solutions_insurance',
    keywords: [
      'insurance claims documentation software',
      'property damage evidence',
      'AI property condition report',
    ],
  },
  'field-teams': {
    slug: 'field-teams',
    path: '/solutions/field-teams',
    title: 'Service & field teams',
    headline: 'Mobile capture',
    accent: 'with office-ready handoffs',
    problem:
      'Technicians and inspectors in the field need fast capture, on-site AI feedback, and a clean handoff to coordinators—without retyping notes.',
    bullets: [
      'Mobile field capture with instant AI analysis',
      'Formal reports for job completion and customer sign-off',
      'Shareable evidence links and reports for dispatchers',
      'Multiple properties under one technician account today',
    ],
    workflows: [
      {
        title: 'Pre-work site inspection',
        description: 'Document condition before starting repairs or renovations',
        steps: [
          'Technician walks site with mobile app, captures photos per area',
          'AI analyzes photos and flags existing damage or concerns',
          'Generate timestamped report showing pre-work condition',
          'Share report with customer and office for job file records',
        ],
      },
      {
        title: 'Job completion documentation',
        description: 'Prove work quality and handoff results to dispatchers',
        steps: [
          'Capture post-work photos showing completed repairs',
          'Compare before/after automatically to highlight improvements',
          'Generate report with photos, work notes, and customer sign-off',
          'Share report link with dispatcher and customer instantly',
        ],
      },
      {
        title: 'Multi-site inspection route',
        description: 'Efficiently document multiple properties in one day',
        steps: [
          'Technician manages multiple properties in one account',
          'Document each stop on the route with structured photo capture',
          'AI provides instant feedback on issues detected at each location',
          'Office receives all reports and can prioritize follow-up work',
        ],
      },
    ],
    analyticsLabel: 'solutions_field',
    keywords: [
      'field service property inspection',
      'mobile home inspection AI',
      'contractor documentation software',
    ],
  },
  platform: {
    slug: 'platform',
    path: '/solutions/platform',
    title: 'Prop-tech platforms',
    headline: 'Property intelligence',
    accent: 'for your product roadmap',
    problem:
      'Platforms serving owners, renters, or insurers need a credible AI layer for condition evidence and document intelligence—co-designed before you commit engineering.',
    bullets: [
      'AI condition analysis, reports, and document retrieval today',
      'Shareable evidence links embeddable in your workflows',
      'Enterprise program to map integrations and portfolio rollups',
      'Built on Google Cloud infrastructure',
    ],
    workflows: [
      {
        title: 'Proof-of-concept integration',
        description: 'Test property intelligence features with your users',
        steps: [
          'Your users access AssetMem via standalone app or shared links',
          'Capture property condition, generate reports, and answer document questions',
          'Review results to validate AI quality and feature fit',
          'Map integration points: where reports/data flow into your platform',
        ],
      },
      {
        title: 'Embedded evidence capture',
        description: 'Add property inspection to your existing workflows',
        steps: [
          'Users capture inspections within your platform experience',
          'AI analysis, scoring, and comparisons happen in background',
          'Evidence links and reports surface in your UI where needed',
          'Data exports feed your reporting, analytics, or compliance systems',
        ],
      },
      {
        title: 'Portfolio rollup and reporting',
        description: 'Aggregate condition intelligence across properties',
        steps: [
          'Properties on your platform get consistent structured condition captures',
          'Condition scores, trends, and flagged issues roll up per portfolio',
          'Your users see property health metrics in your dashboards',
          'Export data for your analytics, risk models, or investor reporting',
        ],
      },
    ],
    analyticsLabel: 'solutions_platform',
    keywords: [
      'prop-tech AI integration',
      'property intelligence API',
      'embedded property inspection',
    ],
  },
};

export const SOLUTION_SLUGS = Object.keys(SOLUTION_PAGES) as SolutionSlug[];

export const SOLUTION_HUB_INTRO =
  'Built for property operations at scale—unified evidence capture, audit-ready reports, and document intelligence across portfolios. Choose your segment to see what teams use today and what we co-design with you.';
