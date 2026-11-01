import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSearchBlinks, useTrendingTags } from '@/api/blinks';
import { useSearchProfiles, useSuggestedProfiles } from '@/api/profiles';
import { AppHeader } from '@/components/app-header';
import { BlinkCard } from '@/components/blink-card';
import { EnterItem } from '@/components/motion';
import { contentColumn, Screen } from '@/components/screen';
import { EmptyState, ErrorState } from '@/components/screen-states';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { UserRow } from '@/components/user-row';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

export default function SearchScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [term, setTerm] = useState(query.trim());

  // Tapping a #hashtag elsewhere opens this tab with ?q=#tag.
  useEffect(() => {
    if (params.q) setQuery(params.q);
  }, [params.q]);

  // Wait until typing pauses before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearching = term.length > 0;
  const trending = useTrendingTags();
  const suggested = useSuggestedProfiles(userId);
  const people = useSearchProfiles(term);
  const blinks = useSearchBlinks(term);

  const peopleList = (isSearching ? people.data : suggested.data) ?? [];
  const blinkList = isSearching ? (blinks.data ?? []) : [];
  const isLoading = isSearching && (people.isFetching || blinks.isFetching) && !people.data && !blinks.data;
  const hasError = isSearching && (people.isError || blinks.isError);
  const hasNoResults =
    isSearching && people.isSuccess && blinks.isSuccess && peopleList.length === 0 && blinkList.length === 0;

  const header = (
    <View style={{ gap: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md }}>
      {!isSearching && (trending.data?.length ?? 0) > 0 && (
        <Section title="Trending on Blinkr">
          <View style={[styles.tags, { paddingHorizontal: gutter }]}>
            {trending.data!.map((tag, index) => (
              <TagChip key={tag} tag={tag} rank={index + 1} onPress={() => setQuery(tag)} />
            ))}
          </View>
        </Section>
      )}

      {peopleList.length > 0 && (
        <Section title={isSearching ? 'People' : 'Who to follow'}>
          {peopleList.map((person) => (
            <UserRow key={person.id} user={person} isMe={person.id === userId} />
          ))}
        </Section>
      )}

      {blinkList.length > 0 && <SectionTitle title="Blinks" />}
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Search" />
      <View style={contentColumn}>
        <View style={{ paddingHorizontal: gutter }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search Blinks, people or #tags" />
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : hasError ? (
          <ErrorState message="Search isn’t working right now." onRetry={() => (people.refetch(), blinks.refetch())} />
        ) : hasNoResults ? (
          <EmptyState
            icon="search-outline"
            title={`No results for “${term}”`}
            message="Try a different word, a name, or a #hashtag."
            actionLabel="Clear search"
            onAction={() => setQuery('')}
          />
        ) : (
          <FlatList
            data={blinkList}
            keyExtractor={(blink) => blink.id}
            renderItem={({ item, index }) => (
              <EnterItem index={index}>
                <BlinkCard blink={item} onPress={() => router.push(`/blink/${item.id}`)} />
              </EnterItem>
            )}
            ListHeaderComponent={header}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.md }}>
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { gutter } = useLayout();
  return (
    <ThemedText variant="label" color="textSecondary" style={{ paddingHorizontal: gutter }}>
      {title}
    </ThemedText>
  );
}

/** A trending tag: an outlined pill with its rank, like a numbered index entry. */
function TagChip({ tag, rank, onPress }: { tag: string; rank: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Search ${tag}, trending number ${rank}`}
      style={({ pressed }) => [
        styles.tag,
        { borderColor: theme.border, backgroundColor: pressed ? theme.tintSoft : theme.surface },
      ]}>
      <Text style={[styles.tagRank, { color: theme.textSecondary }]}>{rank}</Text>
      <Text style={[styles.tagText, { color: theme.tint }]}>{tag}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: Spacing.xxl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tagRank: { fontFamily: Fonts.serif, fontSize: 15 },
  tagText: { fontFamily: Fonts.bold, fontSize: 14 },
});
