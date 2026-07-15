/** Blog post data and content for AssetMem AI stories. */

export type BlogSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'list'; items: string[] }
  | { type: 'divider' };

export type BlogPost = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: 'primary' | 'accent' | 'green';
  readTime: string;
  date: string;
  excerpt: string;
  content: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'caught-water-leak-before-disaster',
    title: 'We Caught a $40,000 Leak Before It Became a $400,000 Problem',
    subtitle:
      'A routine quarterly checkpoint comparison flagged a 2% ceiling discoloration change. What the plumber found behind that wall changed how we think about preventive documentation.',
    category: 'Property Management',
    categoryColor: 'primary',
    readTime: '5 min read',
    date: 'March 10, 2025',
    excerpt:
      'A routine quarterly checkpoint comparison flagged a 2% ceiling discoloration change. What the plumber found behind that wall changed how we think about preventive documentation.',
    content: [
      {
        type: 'paragraph',
        text: "I manage 22 residential units across three buildings in the Pacific Northwest. Until last year, my inspection routine was the same as everyone else's: walk through once a quarter, take photos on my phone, upload them to a shared drive labeled by date, and hope nothing looked dramatically worse than last time.",
      },
      {
        type: 'paragraph',
        text: "The problem is that 'dramatically worse' is hard to see when change happens slowly. Water doesn't usually announce itself. It seeps. It stains. It spreads behind walls for months before you find the bulge or smell the mold.",
      },
      {
        type: 'heading',
        text: 'The checkpoint that changed everything',
      },
      {
        type: 'paragraph',
        text: "In October, I ran my quarterly walkthrough of Building B. Unit 204 looked fine to my eye — tidy kitchen, no obvious damage, tenant had just renewed for another year. I uploaded the photos the same day.",
      },
      {
        type: 'paragraph',
        text: "That evening, I got an AI comparison alert. The system had placed the new ceiling photo next to the one from July and flagged a 2.1% change in a specific region above the sink. The visual diff showed a subtle shift in tone in a six-inch band near the cabinet edge — something I genuinely hadn't noticed standing in the unit.",
      },
      {
        type: 'quote',
        text: '"Change detected in ceiling region: slight discoloration consistent with early moisture accumulation. Recommend inspection within 30 days."',
        attribution: 'AssetMem AI analysis, October 14, 2024',
      },
      {
        type: 'paragraph',
        text: "I almost dismissed it. The unit looked fine. The tenant hadn't reported anything. But I'd already had one mold remediation claim the prior year that cost me $18,000 and two months of vacancy, so I called a plumber.",
      },
      {
        type: 'heading',
        text: 'What was behind the wall',
      },
      {
        type: 'paragraph',
        text: "The plumber cut a small inspection hole behind the cabinet. A compression fitting on the cold supply line had been slowly weeping for what he estimated was two to four months. The drywall was wet. The insulation was saturated. If it had gone another two or three months, we'd be looking at structural drywall replacement, cabinet removal, potential mold testing, and extended tenant displacement.",
      },
      {
        type: 'paragraph',
        text: "The repair was $1,200. A compression fitting, some drywall patch, and two days of fans. If I'd missed the quarter or eyeballed the ceiling the same way I always had, the bill would have been in the $40,000–$60,000 range — and that's before insurance complications.",
      },
      {
        type: 'heading',
        text: 'What this changed in how I work',
      },
      {
        type: 'paragraph',
        text: "I used to think the value of inspection photos was in the photos themselves — a record you'd pull if there was a dispute. Now I think the value is in comparison over time. A single photo of a ceiling tells you almost nothing. A comparison of the same ceiling across four quarters tells you if something is moving.",
      },
      {
        type: 'list',
        items: [
          'I now checkpoint every unit quarterly, not just when something looks off',
          'I use consistent framing — same corner, same angle — so the AI has clean data to compare',
          'I set alerts for any region-level change above 1.5% in bathrooms and kitchens',
          "I share the AI condition reports with my insurance broker annually as part of our renewal documentation",
        ],
      },
      {
        type: 'paragraph',
        text: "The insurance angle is something I didn't expect. My broker said having timestamped, AI-scored condition evidence across all units strengthened our renewal application. We held the same premium for the third year running despite two claims in that period.",
      },
      {
        type: 'divider',
      },
      {
        type: 'paragraph',
        text: "The $1,200 repair is the story. But the real lesson is that I almost didn't make the call. If the comparison hadn't flagged it, I'd have scrolled past 200 photos from that walkthrough and moved on. The slow things are the expensive things — and slow things don't announce themselves in a single frame.",
      },
    ],
  },

  {
    slug: 'insurance-claim-settled-in-4-days',
    title: "Our Insurance Adjuster Called It the Best-Documented Claim She'd Seen in 12 Years",
    subtitle:
      'When a burst pipe flooded two units in January, we had 18 months of timestamped, AI-analyzed condition evidence ready to share. The claim settled in 4 days.',
    category: 'Insurance & Claims',
    categoryColor: 'accent',
    readTime: '6 min read',
    date: 'May 20, 2025',
    excerpt:
      "When a burst pipe flooded two units in January, we had 18 months of timestamped, AI-analyzed condition evidence ready to share. The claim settled in 4 days.",
    content: [
      {
        type: 'paragraph',
        text: "January 7th, 6:40 AM. A text from my tenant in Unit 3: 'There's water coming through my ceiling.' By the time I got there, two inches of standing water covered the kitchen floor and the unit below was soaked through the recessed lighting.",
      },
      {
        type: 'paragraph',
        text: "A supply line to the upstairs bathroom had frozen during a cold snap and burst sometime overnight. By 9 AM I had mitigation crews on site. By 10 AM I had filed with my insurer. By 10:30 AM, I had uploaded 18 months of checkpoint records to the claims portal.",
      },
      {
        type: 'paragraph',
        text: "By January 11th — four days later — the claim was settled.",
      },
      {
        type: 'heading',
        text: 'What made it different',
      },
      {
        type: 'paragraph',
        text: "The adjuster, a 12-year veteran named Diane, called me personally after the settlement. She said it was the clearest pre-loss documentation she'd seen in her career. I want to explain exactly what she had access to.",
      },
      {
        type: 'paragraph',
        text: "For every bathroom, kitchen, and mechanical space in that building, I had quarterly checkpoint photos going back six quarters. Each photo came with an AI-generated condition score (0–100), a list of detected items and conditions, and a change-detection comparison against the prior quarter. The system had flagged a minor pipe insulation gap near the exterior wall in Q3 — I'd scheduled a contractor but hadn't gotten to it before the freeze.",
      },
      {
        type: 'quote',
        text: '"This is exactly what I need. Date-stamped photos, condition scores, and a documented gap that you had already flagged. This tells me the loss is genuine and shows you were acting in good faith. We\'re not going to dispute this."',
        attribution: 'Diane, Insurance Adjuster',
      },
      {
        type: 'heading',
        text: 'The documentation that mattered most',
      },
      {
        type: 'list',
        items: [
          'Pre-loss baseline: AI-scored bathroom condition at 84/100 in October — clearly functional and well-maintained before the incident',
          'Flagged risk: The Q3 comparison had noted a minor gap in pipe insulation as a potential cold-weather vulnerability',
          'Tenant history: The checkpoint records showed the unit had been properly occupied and maintained throughout — no pre-existing water damage or neglect',
          'Scope evidence: Post-loss photos automatically compared against the pre-loss baseline, making the extent of damage quantifiable rather than estimated',
        ],
      },
      {
        type: 'paragraph',
        text: "The insurer covered remediation for both units, temporary accommodation for the displaced tenants, and the plumbing repair — a total settlement of $61,400. The typical timeline for a water damage claim of this size is 3–6 weeks. Ours took 4 days.",
      },
      {
        type: 'heading',
        text: "What I'd tell other landlords",
      },
      {
        type: 'paragraph',
        text: "Most insurance disputes come down to one question: what was the condition of the property before the loss? Without documentation, that question is answered by the adjuster's assessment of the damage — which is always a negotiation. With documentation, the baseline is a fact, not an estimate.",
      },
      {
        type: 'paragraph',
        text: "I now send my insurer an annual condition report across all units as part of my policy renewal. My broker has started recommending this approach to other clients in our area. The conversation has shifted from 'prove the damage was real' to 'here's the story of this property over the last two years.'",
      },
      {
        type: 'divider',
      },
      {
        type: 'paragraph',
        text: "The burst pipe was bad. But the four-day settlement meant my tenants were in temporary housing for a week instead of two months while the claim wound through the process. That outcome — for me and for them — was entirely downstream of having the records ready.",
      },
    ],
  },

  {
    slug: 'hoa-landscape-audit-34-properties',
    title: 'How We Documented 34 HOA Landscape Zones in Two Weeks — With Two People',
    subtitle:
      "Our HOA board wanted photographic evidence that every property's irrigation and plantings met covenant standards. Here's how we did it without a single spreadsheet.",
    category: 'Landscaping & HOA',
    categoryColor: 'green',
    readTime: '5 min read',
    date: 'July 1, 2025',
    excerpt:
      "Our HOA board wanted photographic evidence that every property's irrigation and plantings met covenant standards. Here's how we did it without a single spreadsheet.",
    content: [
      {
        type: 'paragraph',
        text: "Our HOA covers 34 single-family homes in a community with strict CC&R requirements for front-yard landscaping, irrigation coverage, and weed control. Every spring, we're supposed to audit compliance. Every spring, we didn't — because no one wanted to spend two weeks on a spreadsheet.",
      },
      {
        type: 'paragraph',
        text: "This year, the board voted to actually do it. We had 30 days before our annual meeting and two volunteers with smartphones. Here's what we figured out.",
      },
      {
        type: 'heading',
        text: 'Setting up the audit framework',
      },
      {
        type: 'paragraph',
        text: "We created one property record for each home and set up checkpoint categories for landscape and irrigation — front lawn, garden beds, irrigation zone coverage, drainage, and tree/shrub health. Every property would get the same set of checkpoints so we could compare across the community, not just track each property over time.",
      },
      {
        type: 'paragraph',
        text: "The mobile app let us capture and categorize everything on-site. We'd walk up to a property, open the app, select the property, tap 'New Checkpoint,' choose the zone (e.g., 'Front Lawn' or 'Sprinkler Zone'), take the photo, and move on. The AI analysis ran in the background while we were at the next house.",
      },
      {
        type: 'heading',
        text: 'What the AI found that we missed',
      },
      {
        type: 'paragraph',
        text: "By the time we finished the first eight properties on day one, the AI had already surfaced two findings we hadn't noticed in person. Property 7 had a sprinkler head flagged as potentially misaligned, with an estimated dry zone covering roughly a third of the front lawn. Property 12 had early signs of drought stress in the garden beds that looked fine from the street but showed in the color distribution of the close-up photo.",
      },
      {
        type: 'quote',
        text: '"Detected dry patch approximately 4 feet in diameter near the right sprinkler zone boundary. Possible head misalignment or blockage. Recommend irrigation inspection."',
        attribution: 'AssetMem AI, Property 7 analysis',
      },
      {
        type: 'paragraph',
        text: "We went back to both properties. Property 7's head was partially blocked by a rock that had settled over the winter. Property 12's drip lines had disconnected from the manifold — the owner had been hand-watering and didn't know.",
      },
      {
        type: 'heading',
        text: 'The board presentation',
      },
      {
        type: 'paragraph',
        text: "At the annual meeting, we presented a condition summary across all 34 properties with AI-generated scores for plant health, irrigation coverage, and drainage. The board could see, for the first time, an actual quantified picture of community landscape health — not just 'things look okay.'",
      },
      {
        type: 'list',
        items: [
          '28 of 34 properties met all three CC&R landscape standards',
          '4 properties had irrigation issues requiring owner follow-up',
          '2 properties had weed infestation scores above the acceptable threshold',
          'Average front-lawn plant health score: 81/100',
          "We issued courtesy notices to 6 homeowners with specific photographic evidence and AI descriptions — no arguments about what was or wasn't there",
        ],
      },
      {
        type: 'paragraph',
        text: "The 6 follow-up notices were the part I'd dreaded most. In previous years, any compliance conversation became a dispute about whether a problem actually existed. This year, every notice included a timestamped photo, an AI condition score, and a specific description of the issue. Every homeowner responded within a week. Five resolved voluntarily. One came to the board meeting and asked for an extension.",
      },
      {
        type: 'heading',
        text: "What we'll do differently next year",
      },
      {
        type: 'paragraph',
        text: "Now that we have a baseline, the annual audit becomes a comparison exercise rather than a census. We can run the same checkpoints next spring and see, zone by zone, whether conditions improved, stayed the same, or declined. The AI will flag changes automatically — we won't need to compare photos manually.",
      },
      {
        type: 'paragraph',
        text: "We're also planning to checkpoint the irrigation infrastructure specifically — controller settings, backflow preventers, and zone maps — so we have a technical record in addition to the visual one.",
      },
      {
        type: 'divider',
      },
      {
        type: 'paragraph',
        text: "Two people, 34 properties, two weeks — including follow-up. The actual photography took about four days. The rest was the AI doing the analysis, scoring, and report drafting while we worked on other things. For a volunteer board running a community on nights and weekends, that's the only way an audit like this ever actually happens.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
