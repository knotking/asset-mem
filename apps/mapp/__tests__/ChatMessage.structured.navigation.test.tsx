import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ChatMessage from '@/components/ChatMessage';
import { garageDoorDualFormatMessage } from './fixtures/messages';

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children }: { children: string }) => <Text>{children}</Text>;
});

jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => <Text testID="youtube-mock">YouTube</Text>;
});

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

jest.mock('@homeapp/common/contexts/saved-service-providers-context', () => ({
  useSavedServiceProviders: () => ({
    savedProviders: [],
    loading: false,
    isSaved: () => false,
    saveProvider: jest.fn(async () => 'saved'),
    removeProvider: jest.fn(async () => {}),
  }),
}));

function renderInNavigation(ui: React.ReactElement) {
  return render(<NavigationContainer>{ui}</NavigationContainer>);
}

describe('ChatMessage structured checkpoint (real accordion, navigation context)', () => {
  it('renders visible structured sections without navigation context error', () => {
    expect(() =>
      renderInNavigation(
        <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
      )
    ).not.toThrow();
  });

  it('shows checkpoint accordion labels after stream payload is displayable', () => {
    const { getByText } = renderInNavigation(
      <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
    );

    expect(getByText('Garage Door Maintenance Analysis: 1982 Helena Way')).toBeTruthy();
    expect(getByText('Checkpoint Summary')).toBeTruthy();
    expect(getByText('Coverage Analysis')).toBeTruthy();
    expect(getByText('DIY Recommendations')).toBeTruthy();
    expect(getByText('Service Recommendations')).toBeTruthy();
    expect(getByText('Cost Estimates')).toBeTruthy();
  });
});
