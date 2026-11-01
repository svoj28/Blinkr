import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { useDeleteBlink, useToggleLike } from '@/api/blinks';
import { getOrCreateConversation } from '@/api/messages';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { MoodBadge } from '@/components/mood-badge';
import { PressableScale, snappy } from '@/components/motion';
import { Photo } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useTone } from '@/hooks/use-tone';
import { publicImageUrl } from '@/lib/images';
import { useAuth } from '@/state/auth-context';
import type { Blink } from '@/types';
import { formatCount, formatRelativeTime, formatTimeLeft } from '@/utils/format';

type BlinkCardProps = {
  blink: Blink;
  /** Opens the Blink. Omit on the details screen, where the card is already open. */
  onPress?: () => void;
  /** Called by the comment button. Defaults to `onPress`. */
  onCommentPress?: () => void;
  /** Serif "pull quote" text and a stats line, used on the Blink details screen. */
  isDetail?: boolean;
  /** Called after you delete this Blink (the details screen closes itself). */
  onDeleted?: () => void;
};

/** A Blink as a card with a slim edge in the author's accent color. */
export function BlinkCard({ blink, onPress, onCommentPress, isDetail = false, onDeleted }: BlinkCardProps) {
  const theme = useTheme();
  const { author } = blink;
  const tone = useTone(author.id);
  const { gutter, avatarSize } = useLayout();
  const { userId } = useAuth();
  const toggleLike = useToggleLike();
  const deleteBlink = useDeleteBlink();
  const [menuOpen, setMenuOpen] = useState(false);

  const isMine = author.id === userId;
  const openAuthor = () => router.push(`/user/${author.id}`);

  const shareBlink = () => {
    const text = blink.text || (blink.mood ? `Feeling ${blink.mood}` : '');
    Share.share({ message: `${author.displayName} on Blinkr: "${text}"` }).catch(() => {});
  };

  const messageAuthor = async () => {
    try {
      router.push(`/chat/${await getOrCreateConversation(author.id)}`);
    } catch (error) {
      Alert.alert('Couldn’t open the chat', error instanceof Error ? error.message : String(error));
    }
  };

  const confirmDelete = () => {
    const remove = () =>
      deleteBlink.mutate(blink, {
        onSuccess: () => onDeleted?.(),
        onError: (error) => Alert.alert('Couldn’t delete this Blink', error.message),
      });
    // Alert buttons don't work in the browser.
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this Blink? This can’t be undone.')) remove();
      return;
    }
    Alert.alert('Delete this Blink?', 'It will be removed for everyone. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  // Edit and Delete are only offered on your own Blinks (the database enforces this too).
  const actions: SheetAction[] = isMine
    ? [
        { key: 'edit', label: 'Edit Blink', icon: 'create-outline', onPress: () => router.push(`/blink/edit/${blink.id}`) },
        { key: 'share', label: 'Share', icon: 'share-outline', onPress: shareBlink },
        { key: 'delete', label: 'Delete Blink', icon: 'trash-outline', tone: 'danger', onPress: confirmDelete },
      ]
    : [
        { key: 'profile', label: `View @${author.username}`, icon: 'person-outline', onPress: openAuthor },
        { key: 'message', label: `Message @${author.username}`, icon: 'chatbubble-outline', onPress: messageAuthor },
        { key: 'share', label: 'Share', icon: 'share-outline', onPress: shareBlink },
      ];

  const timeLeft = formatTimeLeft(blink.expiresAt);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={onPress ? 0.985 : 1}
      // Not an accessibility element itself, so screen readers can still reach the
      // like/comment/share buttons inside. The comment button opens the Blink instead.
      // (Not `disabled` when there's no onPress: that would also disable those buttons.)
      accessible={false}
      style={{ marginHorizontal: gutter, marginBottom: Spacing.md }}>
      {({ pressed }) => (
        <Card accentColor={tone} pressed={pressed && !!onPress} style={styles.card}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={openAuthor}
              accessibilityRole="link"
              accessibilityLabel={`${author.displayName}'s profile`}
              style={styles.header}>
              <Avatar user={author} size={avatarSize} />
              <View style={styles.meta}>
                <ThemedText variant="bodyStrong" numberOfLines={1}>
                  {author.displayName}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                  @{author.username} · {formatRelativeTime(blink.createdAt)}
                  {blink.editedAt ? ' · edited' : ''}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More options for this Blink"
              hitSlop={8}
              style={({ pressed }) => [styles.more, pressed && { backgroundColor: theme.tintSoft }]}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {blink.mood && <MoodBadge id={blink.mood} large={isDetail} />}

          {blink.text.length > 0 && <BlinkText text={blink.text} large={isDetail} />}

          {blink.imagePath && (
            <Photo
              uri={publicImageUrl('blink-images', blink.imagePath)}
              accessibilityLabel={`Photo from ${author.displayName}`}
            />
          )}

          {isDetail && (
            <ThemedText variant="caption" color="textSecondary">
              <ThemedText variant="captionStrong">{formatCount(blink.likeCount)}</ThemedText>{' '}
              {blink.likeCount === 1 ? 'Like' : 'Likes'} ·{' '}
              <ThemedText variant="captionStrong">{formatCount(blink.commentCount)}</ThemedText>{' '}
              {blink.commentCount === 1 ? 'Comment' : 'Comments'}
            </ThemedText>
          )}

          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <ActionButton
              icon={blink.likedByMe ? 'heart' : 'heart-outline'}
              color={blink.likedByMe ? theme.like : theme.textSecondary}
              count={blink.likeCount}
              label={blink.likedByMe ? 'Unlike this Blink' : 'Like this Blink'}
              onPress={() => toggleLike.mutate(blink)}
              popWhen={blink.likedByMe}
            />
            <ActionButton
              icon="chatbubble-outline"
              color={theme.textSecondary}
              count={blink.commentCount}
              label={onPress ? 'Open this Blink and its comments' : 'Comment on this Blink'}
              onPress={onCommentPress ?? onPress ?? (() => {})}
            />
            <View style={styles.spacer} />
            {/* How long until it disappears for everyone. */}
            <View style={styles.timeLeft} accessibilityLabel={`Disappears: ${timeLeft}`}>
              <Ionicons name="hourglass-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.timeLeftText, { color: theme.textSecondary }]}>{timeLeft}</Text>
            </View>
          </View>

          <ActionSheet
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            title={isMine ? 'Your Blink' : `${author.displayName}’s Blink`}
            subtitle={`Posted ${formatRelativeTime(blink.createdAt)} ago · disappears in ${timeLeft.replace(' left', '')}`}
            actions={actions}
          />
        </Card>
      )}
    </PressableScale>
  );
}

/** Renders Blink text with tappable #hashtags that open Search. */
function BlinkText({ text, large }: { text: string; large: boolean }) {
  const theme = useTheme();
  const parts = text.split(/(#[A-Za-z]\w*)/g);
  return (
    <ThemedText style={large ? styles.largeText : undefined}>
      {parts.map((part, index) =>
        part.startsWith('#') ? (
          <Text
            key={index}
            style={[styles.hashtag, large && { fontFamily: Fonts.serifBold }, { color: theme.tint }]}
            onPress={() => router.navigate({ pathname: '/search', params: { q: part } })}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </ThemedText>
  );
}

type ActionButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  count?: number;
  label: string;
  onPress: () => void;
  /** The icon pops each time this turns true (e.g. the heart when you like). */
  popWhen?: boolean;
};

function ActionButton({ icon, color, count, label, onPress, popWhen }: ActionButtonProps) {
  const scale = useSharedValue(1);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (popWhen) scale.value = withSequence(withSpring(1.4, snappy), withSpring(1, { ...snappy, damping: 10 }));
  }, [popWhen, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={19} color={color} />
      </Animated.View>
      {count !== undefined && <Text style={[styles.actionText, { color }]}>{formatCount(count)}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  header: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meta: { flex: 1 },
  more: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  /** On the details screen the Blink reads like a pull quote. */
  largeText: { fontFamily: Fonts.serif, fontSize: 24, lineHeight: 32 },
  hashtag: { fontFamily: Fonts.bold },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 6,
  },
  spacer: { flex: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, minWidth: 40 },
  actionText: { fontFamily: Fonts.semibold, fontSize: 14 },
  timeLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeLeftText: { fontFamily: Fonts.semibold, fontSize: 13 },
});
