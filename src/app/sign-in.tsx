import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/screen';
import { SignInForm } from '@/components/sign-in-form';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import { useSavedAccounts } from '@/state/saved-accounts';

export default function SignInScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { switchAccount } = useAuth();
  const savedAccounts = useSavedAccounts();
  const [continuingAs, setContinuingAs] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);

  // Signed in: the root layout switches to the app automatically.
  const continueAs = async (userId: string) => {
    setSavedError(null);
    setContinuingAs(userId);
    try {
      await switchAccount(userId);
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : 'Please sign in again.');
    } finally {
      setContinuingAs(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <EnterItem index={0}>
            <Masthead gutter={gutter} />
          </EnterItem>

          <EnterItem index={1} style={[styles.column, { paddingHorizontal: gutter }]}>
            <View style={styles.intro}>
              <ThemedText variant="title">{savedAccounts.length > 0 ? 'Welcome back' : 'Good to see you'}</ThemedText>
              <ThemedText variant="italic" color="textSecondary">
                Sign in to catch today’s Blinks before they fade.
              </ThemedText>
            </View>

            {savedAccounts.length > 0 && (
              <View style={styles.saved}>
                <ThemedText variant="label" color="textSecondary">
                  Continue as
                </ThemedText>
                <Card elevated>
                  {savedAccounts.map((account, index) => (
                    <Pressable
                      key={account.userId}
                      onPress={() => continueAs(account.userId)}
                      disabled={!!continuingAs}
                      accessibilityRole="button"
                      accessibilityLabel={`Continue as ${account.displayName || account.email}`}
                      style={({ pressed }) => [
                        styles.accountRow,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.border },
                        { opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <Avatar
                        user={{ displayName: account.displayName || account.email, avatarColor: account.avatarColor, avatar: account.avatar }}
                        size={40}
                      />
                      <View style={styles.flex}>
                        <ThemedText variant="bodyStrong" numberOfLines={1}>
                          {account.displayName || account.email}
                        </ThemedText>
                        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                          {account.username ? `@${account.username}` : account.email}
                        </ThemedText>
                      </View>
                      {continuingAs === account.userId ? (
                        <ActivityIndicator color={theme.tint} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                      )}
                    </Pressable>
                  ))}
                </Card>
                {savedError && (
                  <ThemedText variant="caption" color="danger" accessibilityRole="alert">
                    {savedError}
                  </ThemedText>
                )}
              </View>
            )}

            {savedAccounts.length > 0 && <Divider label="Or sign in with email" />}
            <SignInForm
              onForgotPassword={(email) =>
                router.push({ pathname: '/forgot-password', params: email ? { email } : {} })
              }
            />

            <Divider label="New to Blinkr?" />
            <Button
              title="Create an account"
              icon="person-add-outline"
              variant="secondary"
              onPress={() => router.push('/sign-up')}
            />

            <ThemedText variant="caption" color="textSecondary" style={styles.footnote}>
              Every Blink fades within 72 hours. Say it while it’s fresh.
            </ThemedText>
          </EnterItem>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** The front-page nameplate: a dateline, the wordmark and the motto between printed rules. */
function Masthead({ gutter }: { gutter: number }) {
  const theme = useTheme();
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={[styles.masthead, { paddingHorizontal: gutter }]}>
      <View style={styles.dateline}>
        <ThemedText variant="label" color="textSecondary">
          Vol. I
        </ThemedText>
        <ThemedText variant="label" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
          {today}
        </ThemedText>
      </View>
      <View style={[styles.ruleThick, { backgroundColor: theme.text }]} />
      <Text accessibilityRole="header" style={[styles.wordmark, { color: theme.text }]}>
        Blinkr<Text style={{ color: theme.tint }}>.</Text>
      </Text>
      <ThemedText variant="italic" color="textSecondary" style={styles.center}>
        Short thoughts, set in print.
      </ThemedText>
      <View style={styles.doubleRule}>
        <View style={[styles.ruleThick, { backgroundColor: theme.text }]} />
        <View style={[styles.ruleThin, { backgroundColor: theme.text }]} />
      </View>
    </View>
  );
}

/** A hairline with a small uppercase label in the middle, like a section break in print. */
function Divider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.lg },
  masthead: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dateline: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  wordmark: {
    fontFamily: Fonts.serifBold,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -1.2,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  center: { textAlign: 'center' },
  doubleRule: { gap: 3, marginTop: Spacing.sm },
  ruleThick: { height: 2 },
  ruleThin: { height: StyleSheet.hairlineWidth * 2 },
  intro: { gap: Spacing.xs },
  saved: { gap: Spacing.sm },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  footnote: { textAlign: 'center', marginTop: Spacing.sm },
});
