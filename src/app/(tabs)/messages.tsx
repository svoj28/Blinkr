import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, RefreshControl, SectionList, View } from 'react-native';

import { useClosedBlinkers } from '@/api/closed-blinkers';
import { getOrCreateConversation, useConversations } from '@/api/messages';
import { useOnlineUsers } from '@/api/presence';
import { useFollowList } from '@/api/profiles';
import { ActiveStrip } from '@/components/active-strip';
import { AppHeader } from '@/components/app-header';
import { ConversationRow, StartChatRow } from '@/components/conversation-row';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-states';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { UnderlineTabs } from '@/components/underline-tabs';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import type { ConversationPreview, ProfileSummary } from '@/types';

type ChatTab = 'friends' | 'closed';

type Item =
  | { kind: 'chat'; key: string; conversation: ConversationPreview }
  | { kind: 'start'; key: string; person: ProfileSummary; note?: string };

type Section = { title?: string; data: Item[] };

const EMPTY: Record<ChatTab, { icon: 'people-outline' | 'lock-closed-outline'; title: string; message: string }> = {
  friends: {
    icon: 'people-outline',
    title: 'No friends to message yet',
    message: 'Friends are people you follow who follow you back. They’ll show up here.',
  },
  closed: {
    icon: 'lock-closed-outline',
    title: 'No Closed Blinkers yet',
    message: 'Add someone with their QR code or UID, and chat with your private circle here.',
  },
};

/**
 * Messages, split two ways: friends (mutual follows) and Closed Blinkers — each person in
 * exactly one: a Closed Blinker who is also a friend only shows under Closed. Chats with anyone
 * else (for example someone you messaged from their profile) are kept under Friends → Other chats.
 * Both start with who’s active now.
 */
export default function MessagesScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const [tab, setTab] = useState<ChatTab>('friends');
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const conversations = useConversations();
  const followers = useFollowList(userId, 'followers');
  const closed = useClosedBlinkers(userId);
  const online = useOnlineUsers();

  const all = conversations.data ?? [];
  const byUser = new Map(all.map((c) => [c.otherUser.id, c]));
  const closedPeople = closed.data?.accepted.map((r) => r.user) ?? [];
  const closedIds = new Set(closedPeople.map((p) => p.id));
  // Closed Blinkers are private: their chats live only under Closed, even if you also follow each other.
  const friends: ProfileSummary[] = followers.data?.filter((p) => p.followedByMe && !closedIds.has(p.id)) ?? [];
  const inCircle = new Set([...friends, ...closedPeople].map((p) => p.id));

  // Existing chats first (newest first), then people you haven't messaged yet.
  const circleSections = (people: ProfileSummary[]): Section[] => {
    const chats = people
      .flatMap((p) => byUser.get(p.id) ?? [])
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .map((c): Item => ({ kind: 'chat', key: c.id, conversation: c }));
    const start = people
      .filter((p) => !byUser.has(p.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((p): Item => ({ kind: 'start', key: p.id, person: p }));
    return [{ data: chats }, { title: 'Start a chat', data: start }];
  };

  // Chats with anyone outside your circles, so no conversation is ever out of reach.
  const otherChats = all
    .filter((c) => !inCircle.has(c.otherUser.id))
    .map((c): Item => ({ kind: 'chat', key: c.id, conversation: c }));

  const sectionsByTab: Record<ChatTab, Section[]> = {
    friends: [...circleSections(friends), { title: 'Other chats', data: otherChats }],
    closed: circleSections(closedPeople),
  };

  const unreadIn = (sections: Section[]) =>
    sections.reduce(
      (sum, s) => sum + s.data.reduce((n, item) => n + (item.kind === 'chat' ? item.conversation.unreadCount : 0), 0),
      0
    );
  const label = (name: string, key: ChatTab) => {
    const unread = unreadIn(sectionsByTab[key]);
    return unread > 0 ? `${name} · ${unread}` : name;
  };
  const tabs: { key: ChatTab; label: string }[] = [
    { key: 'friends', label: label('Friends', 'friends') },
    { key: 'closed', label: label('Closed', 'closed') },
  ];

  const term = query.trim().toLowerCase();
  const matches = (item: Item) => {
    const person = item.kind === 'chat' ? item.conversation.otherUser : item.person;
    return person.displayName.toLowerCase().includes(term) || person.username.includes(term);
  };
  const sections = sectionsByTab[tab]
    .map((s) => ({ ...s, data: term ? s.data.filter(matches) : s.data }))
    .filter((s) => s.data.length > 0);

  // Friends needs the Closed list too, to leave Closed Blinkers out.
  const source = tab === 'friends' && !closed.isPending ? followers : closed;
  const unreadTotal = all.reduce((sum, c) => sum + c.unreadCount, 0);

  const openChat = async (person: ProfileSummary) => {
    const existing = byUser.get(person.id);
    if (existing) return router.push(`/chat/${existing.id}`);
    setOpeningId(person.id);
    try {
      const conversationId = await getOrCreateConversation(person.id);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Couldn’t open the chat', message);
    } finally {
      setOpeningId(null);
    }
  };

  const refresh = () => {
    conversations.refetch();
    followers.refetch();
    closed.refetch();
  };

  const isLoading = conversations.isPending || source.isPending;

  return (
    <Screen>
      <AppHeader
        title="Messages"
        subtitle={
          conversations.isSuccess ? (unreadTotal > 0 ? `${unreadTotal} unread` : 'You’re all caught up') : undefined
        }
      />
      <View style={contentColumn}>
        <View style={{ paddingHorizontal: gutter, gap: Spacing.sm, paddingBottom: Spacing.xs }}>
          <UnderlineTabs tabs={tabs} active={tab} onChange={setTab} />
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search people" />
        </View>

        {conversations.isError && !conversations.data ? (
          <ErrorState
            title="Couldn’t load messages"
            message="Check your connection and try again."
            onRetry={() => conversations.refetch()}
          />
        ) : isLoading ? (
          <LoadingState message="Loading messages…" />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.key}
            renderItem={({ item, index }) => (
              <EnterItem index={index}>
                {item.kind === 'chat' ? (
                  <ConversationRow
                    conversation={item.conversation}
                    myId={userId}
                    onPress={() => router.push(`/chat/${item.conversation.id}`)}
                  />
                ) : (
                  <StartChatRow
                    person={item.person}
                    note={item.note}
                    isOpening={openingId === item.person.id}
                    onPress={() => openChat(item.person)}
                  />
                )}
              </EnterItem>
            )}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <ThemedText
                  variant="label"
                  color="textSecondary"
                  style={{ paddingHorizontal: gutter, paddingTop: Spacing.lg, paddingBottom: Spacing.xs, backgroundColor: theme.background }}>
                  {section.title}
                </ThemedText>
              ) : null
            }
            ListHeaderComponent={
              <ActiveStrip people={tab === 'friends' ? friends : closedPeople} online={online} onPress={openChat} />
            }
            ListEmptyComponent={
              term ? (
                <EmptyState icon="search-outline" title="No one found" message={`Nobody named “${query.trim()}” here.`} />
              ) : (
                <EmptyState
                  icon={EMPTY[tab].icon}
                  title={EMPTY[tab].title}
                  message={EMPTY[tab].message}
                  actionLabel={tab === 'friends' ? 'Find people' : 'Add a Closed Blinker'}
                  onAction={() => router.push(tab === 'friends' ? '/search' : '/closed-blinkers/add')}
                />
              )
            }
            refreshControl={
              <RefreshControl refreshing={conversations.isRefetching} onRefresh={refresh} tintColor={theme.tint} />
            }
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}
      </View>
    </Screen>
  );
}
