const React = require('react');
const { View } = require('react-native');

function VideoView(props) {
  return React.createElement(View, { testID: 'expo-video-mock', ...props });
}

function useVideoPlayer() {
  return { play: jest.fn(), pause: jest.fn() };
}

module.exports = {
  VideoView,
  useVideoPlayer,
};
