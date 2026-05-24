const React = require('react');
const { View, Text } = require('react-native');

/** Captured props from the last GiftedChat render (for regression tests). */
let lastGiftedChatProps = null;

function GiftedChat(props) {
  lastGiftedChatProps = props;
  return React.createElement(
    View,
    { testID: 'gifted-chat-mock' },
    React.createElement(Text, { testID: 'gifted-chat-message-count' }, String(props.messages?.length ?? 0))
  );
}

function InputToolbar(props) {
  return React.createElement(View, { testID: 'gifted-chat-input-toolbar' }, props.children);
}

function Composer() {
  return React.createElement(View, { testID: 'gifted-chat-composer' });
}

function Send() {
  return React.createElement(View, { testID: 'gifted-chat-send' });
}

function getLastGiftedChatProps() {
  return lastGiftedChatProps;
}

function resetGiftedChatMock() {
  lastGiftedChatProps = null;
}

module.exports = {
  GiftedChat,
  InputToolbar,
  Composer,
  Send,
  getLastGiftedChatProps,
  resetGiftedChatMock,
};
