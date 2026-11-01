import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SignInForm } from '@/components/sign-in-form';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';

/**
 * Signs in to another account while staying signed in to this one.
 * Both then show up under "Switch account" in the menu.
 */
export default function AddAccountScreen() {
  const { gutter } = useLayout();

  const done = () => {
    // Now signed in as the new account: start it fresh on the feed.
    router.dismissAll();
    router.navigate('/');
  };

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.column, { paddingHorizontal: gutter }]}>
            <View style={styles.intro}>
              <ThemedText variant="heading">Add another account</ThemedText>
              <ThemedText color="textSecondary">
                You’ll stay signed in to your current account. Switch between them any time from the menu.
              </ThemedText>
            </View>
            <SignInForm submitLabel="Add account" onSignedIn={done} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: Spacing.xl },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  intro: { gap: Spacing.xs },
});
