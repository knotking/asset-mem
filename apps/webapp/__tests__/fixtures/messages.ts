import type { Message } from '@/lib/types';

const now = new Date('2026-01-15T12:00:00.000Z');

export const userTextMessage: Message = {
  id: 'msg-user-1',
  role: 'user',
  content: 'What is the roof condition?',
  contentMarkdown: 'What is the roof condition?',
  createdAt: now,
};

export const partialAssistantMessage: Message = {
  id: 'msg-assistant-partial',
  role: 'assistant',
  content: 'Based on your documents, the roof shows **moderate wear**.',
  contentMarkdown: 'Based on your documents, the roof shows **moderate wear**.',
  createdAt: now,
};

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
  contentMarkdown: '',
  contentJson: {
    analysis: {
      title: 'Roof inspection recommended within 6 months.',
      triageResult: {
        diagnosis: 'Roof inspection recommended within 6 months.',
      },
      coverageResult: {
        warrantyInfo: 'Policy may cover wind damage.',
        insuranceInfo: '',
      },
    },
  },
  createdAt: now,
};

export const garageDoorDualFormatMessage: Message = {
  id: 'msg-assistant-garage-door-dual-format',
  role: 'assistant',
  content: '# Garage Door Maintenance Analysis: 1982 Helena Way',
  contentMarkdown: '# Garage Door Maintenance Analysis: 1982 Helena Way',
  contentJson: {
    analysis: {
      title: 'Garage Door Maintenance Analysis: 1982 Helena Way',
      checkpointSummary: {
        checkpointsAnalyzed: 1,
        issuesDetected: ['Extensive paint chipping on surface and edges', 'Multiple surface scratches'],
        overallCondition: 'Damaged (wear and tear)',
        locations: ['Garage'],
      },
      coverageResult: {
        warrantyInfo: 'No warranty information was found in the provided documents.',
        insuranceInfo:
          'Policy does not provide coverage for damage due to wear and tear, gradual deterioration, marring, denting, scratching, or chipping.',
      },
      diyResults: {
        diySteps: {
          summary:
            'Repairing extensive paint chipping and scratches on a metal garage door is a manageable DIY project.',
          steps: [{ stepNumber: 1, description: 'Plan your project and prep the work area.' }],
        },
        recommendedProducts: {
          products: [
            { item_name: 'Dupli-Color Scratch Fix All-in-1 Touch-Up Paint', vendor: 'AutoZone', url: '', price: '' },
          ],
        },
      },
      serviceResults: {
        localPros: {
          serpAPIResults: [
            { name: 'Ace Handyman Services Brentwood', rating: 4.9, reviews: 424, phone: '(925) 233-5543' },
          ],
          googleSearchResults: ['Local professional painting services in Brentwood, CA'],
        },
      },
      costEstimationResults: {
        costEstimates: {
          repair_type: 'Garage Door Refinishing',
          DIY: { cost_range: '$60 - $250', includes: ['Sandpaper'], savings: '$190 - $650', complexity: 'Moderate' },
          Service: {
            cost_range: '$250 - $900',
            includes: ['Professional prep'],
            benefits: 'Factory-like finish',
            complexity: 'None (Outsourced)',
          },
        },
      },
    },
  },
  createdAt: new Date('2026-05-11T12:00:00.000Z'),
  agentSteps: [
    { name: 'checkpoint_analysis_progress', status: 'completed' },
    { name: 'coverage_agent', status: 'completed' },
    { name: 'diy_agent', status: 'completed' },
    { name: 'service_agent', status: 'completed' },
    { name: 'cost_agent', status: 'completed' },
  ],
};

export const messageFixtures = {
  userTextMessage,
  partialAssistantMessage,
  structuredAssistantMessage,
  garageDoorDualFormatMessage,
};
