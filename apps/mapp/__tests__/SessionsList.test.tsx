import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, renderWithProviders } from './test-utils';
import { generateMockSessions } from './fixtures/sessions';
import { SESSIONS_LIST_FLAT_LIST_PROPS } from '@/lib/sessions-list-utils';

const PROPERTY_ID = 'prop-1';

jest.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@homeapp/common/contexts/session-context', () => ({
  useSession: jest.fn(),
}));

jest.mock('@homeapp/common/contexts/auth-context', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}));

jest.mock('@homeapp/common/contexts/firebase-context', () => ({
  useFirebase: () => ({ db: {} }),
}));

jest.mock('@/lib/api', () => ({
  deleteAgentSession: jest.fn(async () => undefined),
  WEB_APP_URL: 'https://example.com',
}));

const mockUseSession = jest.mocked(
  require('@homeapp/common/contexts/session-context').useSession
);

describe('SessionsList', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      sessionsByProperty: { [PROPERTY_ID]: generateMockSessions(500) },
      draftsByProperty: {},
      isLoading: false,
      beginNewPropertyChatSession: jest.fn(async () => 'new-draft'),
    });
  });

  it('renders FlatList with virtualization props for large session lists', () => {
    const SessionsList = require('@/components/SessionsList').default;
    const { UNSAFE_getByType } = renderWithProviders(<SessionsList propertyId={PROPERTY_ID} />);
    const list = UNSAFE_getByType(FlatList);

    expect(list.props.initialNumToRender).toBe(SESSIONS_LIST_FLAT_LIST_PROPS.initialNumToRender);
    expect(list.props.maxToRenderPerBatch).toBe(SESSIONS_LIST_FLAT_LIST_PROPS.maxToRenderPerBatch);
    expect(list.props.windowSize).toBe(SESSIONS_LIST_FLAT_LIST_PROPS.windowSize);
    expect(list.props.removeClippedSubviews).toBe(SESSIONS_LIST_FLAT_LIST_PROPS.removeClippedSubviews);
    expect(list.props.data).toHaveLength(500);
  });

  it('filters list when search input changes', () => {
    const SessionsList = require('@/components/SessionsList').default;
    const { getByPlaceholderText, UNSAFE_getByType } = renderWithProviders(
      <SessionsList propertyId={PROPERTY_ID} />
    );

    fireEvent.changeText(getByPlaceholderText('Search sessions'), 'mock chat session #42:');

    const list = UNSAFE_getByType(FlatList);
    expect(list.props.data).toHaveLength(1);
    expect(list.props.data[0]?.id).toBe('mock-session-42');
  });

  it('survives rapid search updates (stress-style)', () => {
    const SessionsList = require('@/components/SessionsList').default;
    const { getByPlaceholderText, UNSAFE_getByType } = renderWithProviders(
      <SessionsList propertyId={PROPERTY_ID} />
    );
    const search = getByPlaceholderText('Search sessions');

    act(() => {
      for (let step = 0; step < 10; step++) {
        fireEvent.changeText(search, `mock search query step ${step}`);
      }
      fireEvent.changeText(search, '');
    });

    expect(UNSAFE_getByType(FlatList).props.data).toHaveLength(500);
  });

  it('shows loading indicator when sessions are loading', () => {
    mockUseSession.mockReturnValue({
      sessionsByProperty: {},
      draftsByProperty: {},
      isLoading: true,
      beginNewPropertyChatSession: jest.fn(),
    });

    const SessionsList = require('@/components/SessionsList').default;
    const { UNSAFE_queryByType } = renderWithProviders(<SessionsList propertyId={PROPERTY_ID} />);

    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });
});
