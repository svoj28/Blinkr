import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { useLikedBlinks, useUserBlinks } from '@/api/blinks';
import { useProfile } from '@/api/profiles';
import { HeaderIconButton } from '@/components/app-header';
import { BlinkCard } from '@/components/blink-card';
import { EnterItem } from '@/components/motion';
import { ProfileHeader } from '@/components/profile-header';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { UnderlineTabs } from '@/components/underline-tabs';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

type ProfileTab = 'blinks' | 'likes';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'blinks', label: 'My Blinks' },
  { key: 'likes', label: 'Liked Blinks' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('blinks');

  const profile = useProfile(userId);
  const myBlinks = useUserBlinks(userId ?? '');
  const likedBlinks = useLikedBlinks(tab === 'likes');
  const list = tab === 'blinks' ? myBlinks : likedBlinks;

  // Opened from the menu now that Notifications has the Profile spot in the dock.
  // Settings stays one tap away in the header.
  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <HeaderIconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        ),
      }}
    />
  );

  const refresh = () => {
    profile.refetch();
    list.refetch();
  };

  if (profile.isPending) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <LoadingState message="Loading your profile…" />
      </Screen>
    );
  }

  if (!profile.data) {
    return (
      <Screen edges={['bottom']}>
        {header}
        <ErrorState message="We couldn’t load your profile." onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {header}
      <View style={contentColumn}>
        <FlatList
          data={list.data ?? []}
          keyExtractor={(blink) => blink.id}
          renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <BlinkCard blink={item} onPress={() => router.push(`/blink/${item.id}`)} />
              </EnterItem>
            )}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: gutter, gap: Spacing.lg, paddingVertical: Spacing.lg }}>
              <ProfileHeader profile={profile.data} />
              <UnderlineTabs tabs={PROFILE_TABS} active={tab} onChange={setTab} />
            </View>
          }
          ListEmptyComponent={
            list.isPending ? (
              <LoadingState />
            ) : tab === 'blinks' ? (
              <EmptyState
                icon="create-outline"
                title="You haven’t posted a Blink yet"
                message="Share what’s on your mind. Your Blinks will show up here."
                actionLabel="Create a Blink"
                onAction={() => router.navigate('/create')}
              />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="No liked Blinks yet"
                message="Tap the heart on any Blink and it will be saved here."
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={profile.isRefetching} onRefresh={refresh} tintColor={theme.tint} />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </View>
    </Screen>
  );
}
