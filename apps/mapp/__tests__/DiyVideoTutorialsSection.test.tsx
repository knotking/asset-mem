import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { DiyVideoTutorialsSection } from '@/components/chat/DiyVideoTutorialsSection';

const {
  getYoutubePlayerMountCount,
  resetYoutubePlayerMock,
} = require('react-native-youtube-iframe');

const VIDEOS = [
  {
    title: 'Fix a leaky faucet',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Step-by-step faucet repair',
  },
  {
    title: 'Replace washer',
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    description: 'Washer replacement guide',
  },
];

describe('DiyVideoTutorialsSection', () => {
  beforeEach(() => {
    resetYoutubePlayerMock();
  });

  it('shows preview titles without mounting YouTube players in the accordion', () => {
    const { getByText, queryByTestId } = renderWithProviders(
      <DiyVideoTutorialsSection videos={VIDEOS} />
    );

    expect(getByText('Fix a leaky faucet')).toBeTruthy();
    expect(getByText('Replace washer')).toBeTruthy();
    expect(getByText('View all video tutorials (2)')).toBeTruthy();
    expect(queryByTestId('lazy-youtube-player')).toBeNull();
    expect(getYoutubePlayerMountCount()).toBe(0);
  });

  it('mounts YouTube players only after opening the video tutorials sheet', () => {
    const { getByText, getAllByTestId } = renderWithProviders(
      <DiyVideoTutorialsSection videos={VIDEOS} />
    );

    fireEvent.press(getByText('View all video tutorials (2)'));

    const shells = getAllByTestId('lazy-youtube-player-shell');
    shells.forEach((shell) => {
      fireEvent(shell, 'layout', {
        nativeEvent: { layout: { width: 320, height: 180 } },
      });
    });

    expect(getAllByTestId('lazy-youtube-player')).toHaveLength(2);
    expect(getYoutubePlayerMountCount()).toBe(2);
  });

  it('opens sheet when a preview row is pressed', () => {
    const { getByLabelText, getAllByTestId } = renderWithProviders(
      <DiyVideoTutorialsSection videos={VIDEOS} />
    );

    fireEvent.press(getByLabelText('Play video tutorial: Fix a leaky faucet'));

    const shells = getAllByTestId('lazy-youtube-player-shell');
    shells.forEach((shell) => {
      fireEvent(shell, 'layout', {
        nativeEvent: { layout: { width: 320, height: 180 } },
      });
    });

    expect(getAllByTestId('lazy-youtube-player')).toHaveLength(2);
    expect(getYoutubePlayerMountCount()).toBe(2);
  });
});
