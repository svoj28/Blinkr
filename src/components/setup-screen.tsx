import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';

const STEPS = [
  {
    title: 'Create a Supabase project',
    body: 'Sign in at supabase.com and create a new project (the free plan is fine).',
  },
  {
    title: 'Paste your keys into .env',
    body: 'In Supabase click "Connect". Copy the Project URL and the publishable key into EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  },
  {
    title: 'Create the database',
    body: 'Put the "Session pooler" connection string in SUPABASE_DB_URL and run  npm run db:setup  — or paste supabase/blinkr-schema.sql into the SQL Editor and click Run.',
  },
  {
    title: 'Restart Blinkr',
    body: 'Stop the dev server and run  npx expo start -c  so the new keys are picked up.',
  },
];

/** Shown instead of the app until the Supabase keys are in .env. */
export function SetupScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppHeader subtitle="Almost ready — connect your backend" />
        <View style={[styles.column, { paddingHorizontal: gutter }]}>
          <ThemedText variant="heading">Connect Blinkr to Supabase</ThemedText>
          <ThemedText color="textSecondary">
            Blinkr stores accounts, Blinks, likes, comments and messages in Supabase. It needs your keys before it can
            start.
          </ThemedText>

          {STEPS.map((step, index) => (
            <Card key={step.title} style={styles.step}>
              <ThemedText variant="title" color="tint" style={styles.number}>
                {index + 1}
              </ThemedText>
              <View style={styles.stepText}>
                <ThemedText variant="bodyStrong">{step.title}</ThemedText>
                <ThemedText color="textSecondary">{step.body}</ThemedText>
              </View>
            </Card>
          ))}

          <ThemedText variant="caption" color="textSecondary" style={{ borderTopColor: theme.border }}>
            Full instructions: README.md › Connect Supabase.
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md },
  step: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  number: { width: 28 },
  stepText: { flex: 1, gap: 4 },
});
