import React from 'react';
import { renderWithProviders } from './test-utils';
import { messageFixtures } from './fixtures/messages';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt?: string; [key: string]: unknown }) => (
    <span data-testid="next-image" aria-label={alt} {...props} />
  ),
}));

jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const Tag = String(prop);
        return ({ children, layout: _layout, ...rest }: { children?: React.ReactNode; layout?: boolean }) =>
          React.createElement(Tag, rest, children);
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('@/contexts/saved-service-providers-context', () => ({
  useSavedServiceProviders: () => ({
    savedProviders: [],
    loading: false,
    isSaved: () => false,
    saveProvider: jest.fn(async () => 'saved'),
    removeProvider: jest.fn(async () => {}),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: [],
  }),
}));

describe('ChatMessage', () => {
  it('renders plain user markdown content', () => {
    const { ChatMessage } = require('@/components/chat/chat-message');
    const { getByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.userTextMessage} />,
    );
    expect(getByText(messageFixtures.userTextMessage.contentMarkdown!)).toBeInTheDocument();
  });

  it('renders structured assistant accordion from dual-format payload', () => {
    const { ChatMessage } = require('@/components/chat/chat-message');
    const { getByText, queryByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.garageDoorDualFormatMessage} />,
    );
    expect(getByText(/Garage Door Maintenance Analysis: 1982 Helena Way/i)).toBeInTheDocument();
    expect(queryByText('Working on it…')).not.toBeInTheDocument();
  });

  it('renders structured accordion from contentJson when contentMarkdown is empty', () => {
    const { ChatMessage } = require('@/components/chat/chat-message');
    const { getAllByText, getByText, queryByText } = renderWithProviders(
      <ChatMessage message={messageFixtures.structuredAssistantMessage} />,
    );
    expect(getAllByText(/Roof inspection recommended within 6 months/i).length).toBeGreaterThan(0);
    expect(getByText('Triage Summary')).toBeInTheDocument();
    expect(queryByText('Working on it…')).not.toBeInTheDocument();
  });
});
