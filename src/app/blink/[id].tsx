import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useBlink } from '@/api/blinks';
import { useAddComment, useComments } from '@/api/comments';
import { BlinkCard } from '@/components/blink-card';
import { CommentRow } from '@/components/comment-row';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

export default function BlinkDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { gutter } = useLayout();
  const headerHeight = useHeaderHeight();
  const blinkQuery = useBlink(id);
  const commentsQuery = useComments(id);
  const addComment = useAddComment(id);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const blink = blinkQuery.data;
  const blinkComments = commentsQuery.data ?? [];

  if (blinkQuery.isPending) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Opening Blink…" />
      </Screen>
    );
  }

  if (blinkQuery.isError) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn’t load this Blink." onRetry={() => blinkQuery.refetch()} />
      </Screen>
    );
  }

  if (!blink) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="eye-off-outline"
          title="This Blink isn’t available"
          message="It may have expired, been deleted, or the link is wrong."
          actionLabel="Back to feed"
          onAction={() => router.navigate('/')}
        />
      </Screen>
    );
  }

  const sendComment = () => {
    const text = draft.trim();
    if (!text || addComment.isPending) return;
    setDraft('');
    addComment.mutate(text, {
      onError: (error) => {
        setDraft(text); // put the text back so nothing is lost
        Alert.alert('Couldn’t post your comment', error.message);
      },
    });
  };

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <View style={contentColumn}>
          <FlatList
            data={blinkComments}
            keyExtractor={(comment) => comment.id}
            renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <CommentRow comment={item} />
              </EnterItem>
            )}
            ListHeaderComponent={
              <View>
                <View style={{ paddingTop: Spacing.md }}>
                  <BlinkCard
                    blink={blink}
                    isDetail
                    onCommentPress={() => inputRef.current?.focus()}
                    // Edit and Delete live in the card's ⋯ menu (only on your own Blinks).
                    onDeleted={() => router.back()}
                  />
                </View>
                <ThemedText
                  variant="label"
                  color="textSecondary"
                  style={{ paddingHorizontal: gutter, paddingBottom: Spacing.sm }}>
                  Comments · {blinkComments.length}
                </ThemedText>
              </View>
            }
            ListEmptyComponent={
              commentsQuery.isPending ? (
                <LoadingState message="Loading comments…" />
              ) : commentsQuery.isError ? (
                <ErrorState message="We couldn’t load the comments." onRetry={() => commentsQuery.refetch()} />
              ) : (
                <ThemedText color="textSecondary" style={{ padding: gutter }}>
                  No comments yet. Start the conversation!
                </ThemedText>
              )
            }
            keyboardShouldPersistTaps="handled"
          />

          <View style={[styles.composer, { paddingHorizontal: gutter }]}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Comment text"
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendComment}
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            />
            <Pressable
              onPress={sendComment}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              style={[
                styles.send,
                { backgroundColor: theme.tint, borderColor: theme.border, opacity: draft.trim() ? 1 : 0.4 },
              ]}>
              <Ionicons name="paper-plane" size={18} color={theme.onTint} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: Fonts.medium,
    fontSize: 16,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
