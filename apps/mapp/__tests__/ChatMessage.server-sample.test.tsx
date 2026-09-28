import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { garageDoorDualFormatMessage } from './fixtures/messages';

jest.mock('react-native-markdown-display');
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
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

describe('ChatMessage server-like dual format payload', () => {
  it('renders inline outline and section sheet content from checkpoint analysis payload', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText, getByLabelText, queryByText } = renderWithProviders(
      <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
    );

    expect(getByText(/Garage Door Maintenance Analysis: 1982 Helena Way/i)).toBeTruthy();
    expect(getByText('Report sections')).toBeTruthy();
    expect(getByText(/Extensive paint chipping on surface and edges/i)).toBeTruthy();
    expect(queryByText('Working on it…')).toBeNull();

    fireEvent.press(getByLabelText('Open Service Recommendations'));
    expect(getByText(/Ace Handyman Services Brentwood/i)).toBeTruthy();
  });

  it('renders recommended products in DIY section sheet without View Product links for empty url/price', () => {
    const ChatMessage = require('@/components/ChatMessage').default;
    const { getByText, getByLabelText, queryByText } = renderWithProviders(
      <ChatMessage message={garageDoorDualFormatMessage} sessionId="session-1" />
    );

    fireEvent.press(getByLabelText('Open DIY Recommendations'));

    expect(getByText(/Dupli-Color Scratch Fix All-in-1 Touch-Up Paint/i)).toBeTruthy();
    expect(getByText(/Hampton Bay Patching and Repair Touch Up Marker/i)).toBeTruthy();
    expect(getByText(/X-Protector Touch Up Paint Pen Kit/i)).toBeTruthy();
    expect(getByText(/Dr. ColorChips Basic Paint Chip Repair Kit/i)).toBeTruthy();

    // Empty url/price in fixture — ProductCard must not show broken link buttons
    expect(queryByText('View Product')).toBeNull();
  });
});
