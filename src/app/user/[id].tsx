import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';

import { useUserBlinks } from '@/api/blinks';
import { getOrCreateConversation } from '@/api/messages';
import { useProfile, useToggleFollow } from '@/api/profiles';
import { BlinkCard } from '@/components/blink-card';
import { Button } from '@/components/button';
import { EnterItem } from '@/components/motion';
import { ProfileHeader } from '@/components/profile-header';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

/** Someone else's profile: their details, Follow and Message buttons, and their Blinks. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const profile = useProfile(id);
  const blinks = useUserBlinks(id);
  const toggleFollow = useToggleFollow();
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  // Your own profile lives in the Profile tab.
  if (id === userId) return <Redirect href="/profile" />;

  const openChat = async () => {
    setIsOpeningChat(true);
    try {
      const conversationId = await getOrCreateConversation(id);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert('Couldn’t open the chat', error instanceof Error ? error.message : String(error));
    } finally {
      setIsOpeningChat(false);
    }
  };

  if (profile.isPending) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Loading profile…" />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="We couldn’t load this profile." onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  if (!profile.data) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="person-outline"
          title="This person isn’t on Blinkr"
          message="The account may have been deleted."
          actionLabel="Back to feed"
          onAction={() => router.navigate('/')}
        />
      </Screen>
    );
  }

  const person = profile.data;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: person.displayName }} />
      <View style={contentColumn}>
        <FlatList
          data={blinks.data ?? []}
          keyExtractor={(blink) => blink.id}
          renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <BlinkCard blink={item} onPress={() => router.push(`/blink/${item.id}`)} />
              </EnterItem>
            )}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: gutter, paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.lg }}>
              <ProfileHeader
                profile={person}
                actions={
                  <>
                    <Button
                      title={person.followedByMe ? 'Following' : 'Follow'}
                      icon={person.followedByMe ? 'checkmark' : 'person-add-outline'}
                      variant={person.followedByMe ? 'secondary' : 'primary'}
                      onPress={() => toggleFollow.mutate(person)}
                    />
                    <Button
                      title={isOpeningChat ? 'Opening…' : 'Message'}
                      icon="mail-outline"
                      variant="secondary"
                      onPress={openChat}
                      disabled={isOpeningChat}
                    />
                  </>
                }
              />
              <ThemedText variant="label" color="textSecondary">
                Blinks by {person.displayName}
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            blinks.isPending ? (
              <LoadingState />
            ) : (
              <EmptyState
                icon="newspaper-outline"
                title="No Blinks yet"
                message={`${person.displayName} hasn’t posted a Blink yet.`}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={profile.isRefetching}
              onRefresh={() => (profile.refetch(), blinks.refetch())}
              tintColor={theme.tint}
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </View>
    </Screen>
  );
}
