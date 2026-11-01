import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useStartCall } from '@/api/calls';
import { useClosedBlinkers } from '@/api/closed-blinkers';
import {
  markConversationRead,
  messageKeys,
  useConversation,
  useMessages,
  usePinMessage,
  useSendMessage,
} from '@/api/messages';
import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { MessageBubble } from '@/components/message-bubble';
import { PinnedMessagesSheet } from '@/components/pinned-messages-sheet';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import type { Message } from '@/types';
import { pickImage, type PickedImage } from '@/lib/images';
import { formatChatTimestamp } from '@/utils/format';

/** A date and time is shown above the first message of each hour-long stretch of the chat. */
const TIMESTAMP_INTERVAL_MS = 60 * 60 * 1000;

/** Ids of the messages that start a new hour-long stretch. Messages are newest first. */
function messagesWithTimestamp(messages: Message[]): Set<string> {
  const ids = new Set<string>();
  let stretchStart = -Infinity;
  for (let i = messages.length - 1; i >= 0; i--) {
    const time = new Date(messages[i].createdAt).getTime();
    if (time - stretchStart >= TIMESTAMP_INTERVAL_MS) {
      ids.add(messages[i].id);
      stretchStart = time;
    }
  }
  return ids;
}

/** A one-to-one chat. New messages arrive live (see useRealtimeUpdates). */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { gutter } = useLayout();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const send = useSendMessage(id);
  const pin = usePinMessage(id);
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [showPins, setShowPins] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Mark incoming messages as read whenever a new one shows up while the chat is open.
  const newestUnreadId = messages.data?.find((m) => m.senderId !== userId && !m.readAt)?.id;
  useEffect(() => {
    if (!newestUnreadId) return;
    markConversationRead(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
        queryClient.invalidateQueries({ queryKey: messageKeys.messages(id) });
      })
      .catch(() => {});
  }, [newestUnreadId, id, queryClient]);

  const other = conversation.data?.otherUser;
  // Voice and video calls, and pinned messages, are only offered with accepted Closed Blinkers.
  const closedBlinkers = useClosedBlinkers(userId);
  const isClosedBlinker = !!other && !!closedBlinkers.data?.accepted.some((r) => r.user.id === other.id);
  // Newest first, like the chat. The bar shows the newest; tapping it lists them all.
  const pins = isClosedBlinker ? (messages.data?.filter((m) => m.pinnedAt) ?? []) : [];
  const pinned = pins[0];
  const timestamped = messagesWithTimestamp(messages.data ?? []);

  const setPinned = (message: Message, shouldPin: boolean) =>
    pin.mutate(
      { messageId: message.id, pinned: shouldPin },
      { onError: (error) => Alert.alert(shouldPin ? 'Couldn’t pin the message' : 'Couldn’t unpin the message', error.message) }
    );

  const jumpTo = (message: Message) => {
    setShowPins(false);
    const index = messages.data?.indexOf(message) ?? -1;
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5 });
  };
  const { start: startCall, startingKind } = useStartCall();

  const sendDraft = () => {
    const text = draft.trim();
    if ((!text && !photo) || send.isPending) return;
    const image = isClosedBlinker ? photo : null;
    setDraft('');
    setPhoto(null);
    send.mutate(
      { text, image },
      {
        onError: (error) => {
          // Put everything back so nothing is lost.
          setDraft(text);
          setPhoto(image);
          if (image) Alert.alert('Couldn’t send the photo', error.message);
        },
      }
    );
  };

  // Photos in chats are only for Closed Blinkers (the database checks this too).
  const attachPhoto = async () => {
    try {
      const image = await pickImage();
      if (image) setPhoto(image);
    } catch (error) {
      Alert.alert('Couldn’t add that photo', error instanceof Error ? error.message : String(error));
    }
  };
  const canSend = (!!draft.trim() || !!photo) && !send.isPending;

  const header = (
    <Stack.Screen
      options={{
        title: other?.displayName ?? 'Chat',
        headerRight: other
          ? () => (
              <View style={styles.headerActions}>
                {isClosedBlinker && (
                  <>
                    <Pressable
                      onPress={() => startCall(other, 'audio')}
                      disabled={!!startingKind}
                      accessibilityRole="button"
                      accessibilityLabel={`Voice call ${other.displayName}`}
                      hitSlop={6}>
                      <Ionicons name="call-outline" size={22} color={theme.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => startCall(other, 'video')}
                      disabled={!!startingKind}
                      accessibilityRole="button"
                      accessibilityLabel={`Video call ${other.displayName}`}
                      hitSlop={6}>
                      <Ionicons name="videocam-outline" size={24} color={theme.text} />
                    </Pressable>
                  </>
                )}
                <Pressable
                  onPress={() => router.push(`/user/${other.id}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`${other.displayName}'s profile`}
                  hitSlop={8}>
                  <Avatar user={other} size={32} />
                </Pressable>
              </View>
            )
          : undefined,
      }}
    />
  );

  if (conversation.isPending || messages.isPending) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <LoadingState message="Opening chat…" />
      </Screen>
    );
  }

  if (conversation.isError || messages.isError) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <ErrorState
          message="We couldn’t load this conversation."
          onRetry={() => (conversation.refetch(), messages.refetch())}
        />
      </Screen>
    );
  }

  if (!conversation.data) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <EmptyState
          icon="mail-outline"
          title="Conversation not found"
          message="It may have been removed."
          actionLabel="Back to Messages"
          onAction={() => router.navigate('/messages')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android draws edge-to-edge, so the window no longer shrinks for the keyboard: pad on both.
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        keyboardVerticalOffset={headerHeight}>
        <View style={contentColumn}>
          {pinned && (
            <Animated.View entering={FadeInUp.duration(250)} exiting={FadeOut.duration(150)}>
              <Pressable
                onPress={() => setShowPins(true)}
                accessibilityRole="button"
                accessibilityLabel={`${pins.length === 1 ? 'Pinned message' : `${pins.length} pinned messages`}: ${pinned.text || 'Photo'}`}
                accessibilityHint="Shows all pinned messages"
                style={({ pressed }) => [
                  styles.pinned,
                  { paddingHorizontal: gutter, borderBottomColor: theme.border },
                  pressed && { backgroundColor: theme.tintSoft },
                ]}>
                <Ionicons name="pin" size={16} color={theme.tint} />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="caption" color="textSecondary">
                    {pins.length === 1 ? 'Pinned message' : `${pins.length} pinned messages`}
                  </ThemedText>
                  <ThemedText numberOfLines={1}>{pinned.text || '📷 Photo'}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            </Animated.View>
          )}

          {messages.data && messages.data.length === 0 ? (
            // Shown outside the inverted list: inside it, the platform's flip (which differs
            // between iOS and Android) would mirror this text.
            <View style={styles.empty}>
              <EmptyState
                icon="hand-left-outline"
                title={`Say hello to ${other?.displayName}`}
                message="Messages are private between the two of you."
              />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages.data}
              inverted // newest at the bottom, like every chat
              keyExtractor={(message) => message.id}
              renderItem={({ item }) => (
                <View>
                  {timestamped.has(item.id) && (
                    <ThemedText variant="caption" color="textSecondary" style={styles.timestamp}>
                      {formatChatTimestamp(item.createdAt)}
                    </ThemedText>
                  )}
                  <MessageBubble
                    message={item}
                    isMine={item.senderId === userId}
                    isPinned={isClosedBlinker && !!item.pinnedAt}
                    onLongPress={isClosedBlinker && !item.pending ? () => setSelected(item) : undefined}
                  />
                </View>
              )}
              // Messages vary in height, so a far-off pinned message may need a second try once rendered.
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
                setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5 }), 100);
              }}
              contentContainerStyle={[styles.messages, { paddingHorizontal: gutter }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          )}

          {photo && (
            <View style={[styles.attachment, { paddingHorizontal: gutter }]}>
              <View>
                <Image source={{ uri: photo.uri }} style={styles.attachmentImage} accessibilityLabel="Photo to send" />
                <Pressable
                  onPress={() => setPhoto(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={8}
                  style={[styles.attachmentRemove, { backgroundColor: theme.text, borderColor: theme.background }]}>
                  <Ionicons name="close" size={12} color={theme.background} />
                </Pressable>
              </View>
              <ThemedText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                Only you and {other?.displayName} can see this photo.
              </ThemedText>
            </View>
          )}

          <View style={[styles.composer, { paddingHorizontal: gutter, borderTopColor: theme.border }]}>
            {isClosedBlinker && (
              <Pressable
                onPress={attachPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add a photo, up to 5 MB"
                hitSlop={6}
                style={({ pressed }) => [styles.attach, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="image-outline" size={24} color={theme.tint} />
              </Pressable>
            )}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Message text"
              multiline
              maxLength={1000}
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={sendDraft}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.send, { backgroundColor: theme.tint, opacity: canSend ? 1 : 0.4 }]}>
              <Ionicons name="paper-plane" size={18} color={theme.onTint} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title="Message"
        subtitle={selected?.text || '📷 Photo'}
        actions={
          selected
            ? [
                selected.pinnedAt
                  ? { key: 'unpin', label: 'Unpin message', icon: 'pin-outline', onPress: () => setPinned(selected, false) }
                  : { key: 'pin', label: 'Pin message', icon: 'pin', onPress: () => setPinned(selected, true) },
              ]
            : []
        }
      />

      <PinnedMessagesSheet
        visible={showPins && pins.length > 0}
        onClose={() => setShowPins(false)}
        pins={pins}
        myId={userId}
        otherName={other?.displayName ?? ''}
        onJump={jumpTo}
        onUnpin={(message) => setPinned(message, false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  messages: { flexGrow: 1, paddingVertical: Spacing.md },
  empty: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  timestamp: { textAlign: 'center', marginTop: Spacing.md, marginBottom: Spacing.xs },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: Fonts.medium,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  attach: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  attachmentImage: { width: 64, height: 64, borderRadius: Radius.md },
  attachmentRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
