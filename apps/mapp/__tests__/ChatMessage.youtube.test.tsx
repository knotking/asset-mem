import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { LazyYouTubePlayer } from '@/lib/lazy-youtube-player';

const {
  getYoutubePlayerMountCount,
  resetYoutubePlayerMock,
} = require('react-native-youtube-iframe');

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('LazyYouTubePlayer', () => {
  beforeEach(() => {
    resetYoutubePlayerMock();
  });

  it('does not mount YoutubePlayer when accordion section is collapsed', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <AccordionMountContext.Provider value={false}>
        <LazyYouTubePlayer videoUrl={YOUTUBE_URL} />
      </AccordionMountContext.Provider>
    );

    const shell = getByTestId('lazy-youtube-player-shell');
    expect(shell.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '100%', marginVertical: 8 })])
    );

    fireEvent(shell, 'layout', {
      nativeEvent: { layout: { width: 320, height: 180 } },
    });

    expect(queryByTestId('lazy-youtube-player')).toBeNull();
    expect(getYoutubePlayerMountCount()).toBe(0);
  });

  it('reserves player height before WebView mount when accordion is expanded', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <AccordionMountContext.Provider value={true}>
        <LazyYouTubePlayer videoUrl={YOUTUBE_URL} height={192} />
      </AccordionMountContext.Provider>
    );

    const shell = getByTestId('lazy-youtube-player-shell');
    expect(shell.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: 192 })])
    );
    expect(queryByTestId('lazy-youtube-player')).toBeNull();
  });

  it('mounts YoutubePlayer when accordion is expanded and layout is ready', () => {
    const { getByTestId } = renderWithProviders(
      <AccordionMountContext.Provider value={true}>
        <LazyYouTubePlayer videoUrl={YOUTUBE_URL} />
      </AccordionMountContext.Provider>
    );

    fireEvent(getByTestId('lazy-youtube-player-shell'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 180 } },
    });

    expect(getByTestId('lazy-youtube-player')).toBeTruthy();
    expect(getYoutubePlayerMountCount()).toBe(1);
  });
});
