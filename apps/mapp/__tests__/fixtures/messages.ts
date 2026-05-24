import type { Message } from '@homeapp/common/types';

const now = new Date('2026-01-15T12:00:00.000Z');

/** Plain user message */
export const userTextMessage: Message = {
  id: 'msg-user-1',
  role: 'user',
  content: 'What is the roof condition?',
  createdAt: now,
};

/** Assistant still streaming (empty content, optional steps) */
export const streamingAssistantMessage: Message = {
  id: 'msg-assistant-stream',
  role: 'assistant',
  content: '',
  createdAt: now,
  agentSteps: [{ name: 'doculink_agent', status: 'executing' }],
  primaryAgent: 'docs',
};

/** Partial stream content */
export const partialAssistantMessage: Message = {
  id: 'msg-assistant-partial',
  role: 'assistant',
  content: 'Based on your documents, the roof shows **moderate wear**.',
  createdAt: now,
  primaryAgent: 'docs',
};

/** Structured JSON assistant response (accordion UI) */
export const structuredAssistantMessage: Message = {
  id: 'msg-assistant-structured',
  role: 'assistant',
  content: JSON.stringify({
    triage: {
      summary: 'Roof inspection recommended within 6 months.',
      urgency: 'medium',
    },
    coverage: {
      summary: 'Policy may cover wind damage.',
    },
  }),
  createdAt: now,
  primaryAgent: 'checkpoint',
};

/** Message with attachment */
export const userImageMessage: Message = {
  id: 'msg-user-image',
  role: 'user',
  content: 'Please review this photo.',
  createdAt: now,
  file: {
    name: 'roof.jpg',
    type: 'image/jpeg',
    url: 'https://example.com/roof.jpg',
    width: 800,
    height: 600,
  },
};

/** Realistic dual-format assistant payload from checkpoint analysis stream. */
export const garageDoorDualFormatMessage: Message = {
  id: 'msg-assistant-garage-door-dual-format',
  role: 'assistant',
  content: `# Garage Door Maintenance Analysis: 1982 Helena Way

Following the inspection of your garage door on May 11, 2026, we have identified significant cosmetic damage characterized by extensive paint chipping and surface scratches. The structural integrity of the door remains intact, and this issue is categorized as moderate-severity surface wear.

### Coverage & Insurance
According to your policy documents, damage resulting from wear and tear, gradual deterioration, scratching, or chipping is excluded from coverage. Therefore, this maintenance is the homeowner's responsibility.

### Repair Options
You have two primary paths forward:
*   **DIY Repair:** A project requiring surface prep (sanding/cleaning), priming, and painting. Estimated costs range from **$60 - $250**.
*   **Professional Service:** Hiring local painters for a factory-like finish. Estimated costs range from **$250 - $900**.

### Next Steps
1. **If DIY:** Prepare the surface by removing loose paint and smoothing edges before priming with a rust-inhibitor.
2. **If Service:** Contact highly-rated local professionals such as *Ace Handyman Services* or *Diablo Delta Painting Co* for formal quotes.

\`\`\`json
{
  "analysis": {
    "title": "Garage Door Maintenance Analysis: 1982 Helena Way",
    "checkpointSummary": {
      "checkpointsAnalyzed": 1,
      "issuesDetected": [
        "Extensive paint chipping on surface and edges",
        "Multiple surface scratches"
      ],
      "overallCondition": "Damaged (wear and tear)",
      "locations": [
        "Garage"
      ],
      "dateRange": "2026-05-11"
    },
    "coverageResult": {
      "warrantyInfo": "No warranty information was found in the provided documents.",
      "insuranceInfo": "Policy does not provide coverage for damage due to wear and tear, gradual deterioration, marring, denting, scratching, or chipping."
    },
    "diyResults": {
      "diySteps": {
        "summary": "Repairing extensive paint chipping and scratches on a metal garage door is a manageable DIY project that relies heavily on thorough surface preparation to ensure proper adhesion and long-term durability.",
        "steps": [
          {"stepNumber": 1, "description": "Plan your project by checking the weather forecast to ensure at least two days of dry conditions, and protect the surrounding area with drop cloths and painter's tape."},
          {"stepNumber": 2, "description": "Prepare the surface by scraping off loose or peeling paint, sanding edges smooth, and cleaning the door thoroughly with a TSP solution or soapy water, then allowing it to dry completely."},
          {"stepNumber": 3, "description": "Apply a rust-inhibiting metal primer to all bare metal spots and let it cure according to the manufacturer's instructions."},
          {"stepNumber": 4, "description": "Paint the door using high-quality exterior-grade acrylic latex paint, applying thin, even coats with a roller or sprayer, and allowing proper drying time between coats."}
        ]
      },
      "youtubeSearch": {
        "videos": [
          {"title": "Repairing Blistering/Peeling Paint (Garage Door)", "url": "https://www.youtube.com/watch?v=jcB26XAayNs", "description": "Busy Bee Living"},
          {"title": "How To Paint A Garage Door - Ace Hardware", "url": "https://www.youtube.com/watch?v=t9pKwCS_zqY", "description": "Ace Hardware"},
          {"title": "Fix Peeling Paint on Door", "url": "https://www.youtube.com/watch?v=KEWeO_roRC4", "description": "DIYNorth"}
        ]
      },
      "recommendedProducts": {
        "products": [
          {"item_name": "Dupli-Color Scratch Fix All-in-1 Touch-Up Paint", "vendor": "AutoZone", "url": "", "price": ""},
          {"item_name": "Hampton Bay Patching and Repair Touch Up Marker", "vendor": "Home Depot", "url": "", "price": ""},
          {"item_name": "X-Protector Touch Up Paint Pen Kit", "vendor": "Walmart", "url": "", "price": ""},
          {"item_name": "Dr. ColorChips Basic Paint Chip Repair Kit", "vendor": "Dr. ColorChip", "url": "", "price": ""}
        ]
      }
    },
    "serviceResults": {
      "localPros": {
        "serpAPIResults": [
          {"name": "Ace Handyman Services Brentwood", "rating": 4.9, "reviews": 424, "phone": "(925) 233-5543"},
          {"name": "Brentwood House Painting", "rating": 4.8, "reviews": 6, "phone": "(925) 420-4295"},
          {"name": "Diablo Delta Painting Co", "rating": 5.0, "reviews": 11, "phone": "(925) 513-3244"}
        ],
        "googleSearchResults": ["Local professional painting services in Brentwood, CA"]
      }
    },
    "costEstimationResults": {
      "costEstimates": {
        "repair_type": "Garage Door Refinishing",
        "DIY": {
          "cost_range": "$60 - $250",
          "includes": ["Sandpaper", "Primer", "Exterior-grade paint", "Tape", "Drop cloths"],
          "savings": "$190 - $650",
          "complexity": "Moderate"
        },
        "Service": {
          "cost_range": "$250 - $900",
          "includes": ["Professional prep", "Sanding", "Priming", "Application"],
          "benefits": "Factory-like finish, ensures proper adhesion, saves time",
          "complexity": "None (Outsourced)"
        },
        "comparison": {
          "diy_savings": "Significant potential savings for basic maintenance.",
          "professional_benefits": "Higher durability and finish quality for a high-traffic area.",
          "considerations": "Integrity of the door is intact; aesthetic improvement only."
        }
      }
    }
  }
}
\`\`\``,
  createdAt: new Date('2026-05-11T12:00:00.000Z'),
  primaryAgent: 'checkpoint',
  agentSteps: [
    { name: 'checkpoint_progress_agent', status: 'completed' },
    { name: 'coverage_agent', status: 'completed' },
    { name: 'diy_agent', status: 'completed' },
    { name: 'service_agent', status: 'completed' },
    { name: 'cost_agent', status: 'completed' },
  ],
};

export const messageFixtures = {
  userTextMessage,
  streamingAssistantMessage,
  partialAssistantMessage,
  structuredAssistantMessage,
  userImageMessage,
  garageDoorDualFormatMessage,
};
