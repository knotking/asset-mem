import React from 'react';
import { renderWithProviders } from './test-utils';
import { garageDoorDualFormatMessage } from './fixtures/messages';

jest.mock('react-native-markdown-display');
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

describe('ChatMessage server-like dual format payload', () => {
  it('renders structured sections from checkpoint analysis payload', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText } = renderWithProviders(
      <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
    );

    expect(getByText('Garage Door Maintenance Analysis: 1982 Helena Way')).toBeTruthy();
    expect(getByText('Checkpoint Summary')).toBeTruthy();
    expect(getByText('Coverage Analysis')).toBeTruthy();
    expect(getByText('DIY Recommendations')).toBeTruthy();
    expect(getByText('Service Recommendations')).toBeTruthy();
    expect(getByText('Cost Estimates')).toBeTruthy();
    expect(getByText('Ace Handyman Services Brentwood')).toBeTruthy();
  });

  it('renders recommended products with empty url/price without View Product links', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText, queryByText } = renderWithProviders(
      <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
    );

    expect(getByText('Recommended Products')).toBeTruthy();
    expect(getByText('Dupli-Color Scratch Fix All-in-1 Touch-Up Paint')).toBeTruthy();
    expect(getByText('Hampton Bay Patching and Repair Touch Up Marker')).toBeTruthy();
    expect(getByText('X-Protector Touch Up Paint Pen Kit')).toBeTruthy();
    expect(getByText('Dr. ColorChips Basic Paint Chip Repair Kit')).toBeTruthy();

    expect(getByText('AutoZone')).toBeTruthy();
    expect(getByText('Home Depot')).toBeTruthy();

    // Empty url/price in fixture — ProductCard must not show broken link buttons
    expect(queryByText('View Product')).toBeNull();
  });
});
