const React = require('react');
const { View } = require('react-native');

function Image(props) {
  return React.createElement(View, { testID: props.testID ?? 'expo-image-mock', ...props });
}

module.exports = { Image };
module.exports.Image = Image;
