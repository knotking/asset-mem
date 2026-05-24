import {
  ANDROID_GIFTED_CHAT_LIST_VIEW_PROPS,
  giftedChatListViewPropsForPlatform,
} from '@/lib/property-chat-list-props';

describe('giftedChatListViewPropsForPlatform', () => {
  it('returns Android tuning on android', () => {
    expect(giftedChatListViewPropsForPlatform('android')).toEqual(ANDROID_GIFTED_CHAT_LIST_VIEW_PROPS);
  });

  it('returns undefined on ios', () => {
    expect(giftedChatListViewPropsForPlatform('ios')).toBeUndefined();
  });
});
