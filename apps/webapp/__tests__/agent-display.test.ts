import {
  COORDINATING_LABEL,
  DEFAULT_THINKING_LABEL,
  getAgentStepDisplayLabel,
  getThinkingStatusFromSteps,
  prettifyAgentName,
} from '@/lib/agent-display';
import type { AgentStep } from '@/lib/types';

describe('prettifyAgentName', () => {
  it('maps known agent names to user-facing labels', () => {
    expect(prettifyAgentName('diy_agent')).toBe('Building DIY steps…');
    expect(prettifyAgentName('coverage_agent')).toBe('Checking warranty & insurance…');
  });

  it('uses coordinating label for orchestrator agents', () => {
    expect(prettifyAgentName('property_agent')).toBe(COORDINATING_LABEL);
  });

  it('falls back to default label for unknown agents', () => {
    expect(prettifyAgentName('unknown_agent_xyz')).toBe(DEFAULT_THINKING_LABEL);
  });
});

describe('getAgentStepDisplayLabel', () => {
  it('prefers step displayName when provided', () => {
    const step: AgentStep = {
      name: 'custom_tool',
      status: 'executing',
      displayName: 'Custom step label',
    };
    expect(getAgentStepDisplayLabel(step)).toBe('Custom step label');
  });
});

describe('getThinkingStatusFromSteps', () => {
  it('shows coordinating label when only orchestrator is executing', () => {
    const steps: AgentStep[] = [{ name: 'property_agent', status: 'executing' }];
    expect(getThinkingStatusFromSteps(steps).header).toBe(COORDINATING_LABEL);
  });

  it('shows agent-specific label for an executing specialist step', () => {
    const steps: AgentStep[] = [
      { name: 'property_agent', status: 'completed' },
      { name: 'diy_agent', status: 'executing' },
    ];
    expect(getThinkingStatusFromSteps(steps).header).toBe('Building DIY steps…');
  });

  it('shows parallel analysis label when multiple optional agents run', () => {
    const steps: AgentStep[] = [
      { name: 'coverage_agent', status: 'executing' },
      { name: 'diy_agent', status: 'executing' },
    ];
    expect(getThinkingStatusFromSteps(steps).header).toBe('Analyzing your checkpoints…');
  });

  it('prefers branch progress from nested contentJson over rollup agent step', () => {
    const steps: AgentStep[] = [
      { name: 'run_checkpoint_pipeline', status: 'executing' },
    ];
    const status = getThinkingStatusFromSteps(steps, {
      messageContentJson: {
        analysis: {
          analysisStatus: { coverage: 'running' },
        },
      },
    });
    expect(status.header).toBe('Analyzing checkpoints…');
    expect(status.preview).toBe('Coverage in progress');
  });

  it('prefers coverage agent step over run_checkpoint_pipeline rollup', () => {
    const steps: AgentStep[] = [
      { name: 'run_checkpoint_pipeline', status: 'executing' },
      { name: 'coverage_agent', status: 'executing' },
    ];
    expect(getThinkingStatusFromSteps(steps).header).toBe(
      'Checking warranty & insurance…',
    );
  });
});
