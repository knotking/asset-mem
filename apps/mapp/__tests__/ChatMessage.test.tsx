import React from 'react';
import { renderWithProviders } from './test-utils';
import { messageFixtures } from './fixtures/messages';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
jest.mock('@asset-mem/common/contexts/saved-service-providers-context', () => ({
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
    expect(getByText(messageFixtures.userTextMessage.contentMarkdown!)).toBeTruthy();
  });

  it('renders structured assistant accordion labels from dual-format payload', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText, queryByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.garageDoorDualFormatMessage} sessionId="session-1" />
    );
    expect(getByText(/Garage Door Maintenance Analysis: 1982 Helena Way/i)).toBeTruthy();
    expect(queryByText('Working on it…')).toBeNull();
  });

  it('renders structured accordion from contentJson when contentMarkdown is empty', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getAllByText, getByText, queryByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.structuredAssistantMessage} sessionId="session-1" />
    );
    expect(getAllByText(/Roof inspection recommended within 6 months/i).length).toBeGreaterThan(0);
    expect(getByText('Triage Summary')).toBeTruthy();
    expect(queryByText('Working on it…')).toBeNull();
  });
});
