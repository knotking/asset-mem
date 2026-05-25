import React from 'react';
import { renderWithProviders } from './test-utils';
import { messageFixtures } from './fixtures/messages';

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children }: { children: string }) => <Text>{children}</Text>;
});
jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));
jest.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  AccordionItem: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  AccordionContent: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
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

describe('ChatMessage', () => {
  it('renders plain user markdown content', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.userTextMessage} sessionId="session-1" />
    );
    expect(getByText(messageFixtures.userTextMessage.content)).toBeTruthy();
  });

  it('renders structured assistant accordion labels from dual-format payload', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.garageDoorDualFormatMessage} sessionId="session-1" />
    );
    expect(getByText('Checkpoint Summary')).toBeTruthy();
    expect(getByText('DIY Recommendations')).toBeTruthy();
  });
});
