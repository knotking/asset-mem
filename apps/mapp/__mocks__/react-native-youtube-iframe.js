const React = require('react');
const { View, Text } = require('react-native');

/** Tracks mount count for lazy-embed regression tests. */
let mountCount = 0;

function YoutubePlayer({ videoId, testID = 'youtube-player-mock' }) {
  mountCount += 1;
  return React.createElement(
    View,
    { testID },
    React.createElement(Text, { testID: 'youtube-video-id' }, videoId ?? '')
  );
}

function getYoutubePlayerMountCount() {
  return mountCount;
}

function resetYoutubePlayerMock() {
  mountCount = 0;
}

module.exports = YoutubePlayer;
module.exports.default = YoutubePlayer;
module.exports.getYoutubePlayerMountCount = getYoutubePlayerMountCount;
module.exports.resetYoutubePlayerMock = resetYoutubePlayerMock;
