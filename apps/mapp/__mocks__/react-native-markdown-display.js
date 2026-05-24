const React = require('react');
const { Text } = require('react-native');

/** Renders children as plain text for fast unit tests. */
function Markdown({ children, testID = 'markdown-mock' }) {
  return React.createElement(Text, { testID }, children);
}

module.exports = Markdown;
module.exports.default = Markdown;
