import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EnterItem } from '@/components/motion';
import { PasswordStrength } from '@/components/password-strength';
import { FormError, ResetIntro, ResetSteps } from '@/components/reset-flow';
import { Screen } from '@/components/screen';
import { LoadingState } from '@/components/screen-states';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useAuth } from '@/state/auth-context';
import { friendlyAuthError } from '@/utils/auth-errors';

/**
 * Opened by the link in the "Reset your password" email. The link has already signed you in
 * (held back by the auth context); saving a new password here opens the app.
 */
export default function ResetPasswordScreen() {
  const { gutter } = useLayout();
  const headerHeight = useHeaderHeight();
  const { passwordRecovery, completePasswordRecovery, cancelPasswordRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (isSaving) return;
    const next: typeof fieldErrors = {};
    if (password.length < 6) next.password = 'Use at least 6 characters.';
    else if (confirm !== password) next.confirm = 'The two passwords don’t match.';
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setIsSaving(true);
    try {
      await completePasswordRecovery(password); // the app opens by itself
    } catch (e) {
      setError(friendlyAuthError(e));
      setIsSaving(false);
    }
  };

  const requestNewLink = async () => {
    router.replace('/forgot-password');
    await cancelPasswordRecovery();
  };

  if (!passwordRecovery || passwordRecovery.status === 'verifying') {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Checking your reset link…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        keyboardVerticalOffset={headerHeight}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <EnterItem index={0} style={[styles.column, { paddingHorizontal: gutter }]}>
            {passwordRecovery.status === 'invalid' ? (
              <>
                <ResetIntro
                  icon="alert-circle-outline"
                  tone="danger"
                  title="This link didn’t work"
                  message={passwordRecovery.message}
                />
                <Button title="Send a new link" icon="refresh" onPress={requestNewLink} />
                <Button title="Back to sign in" variant="secondary" onPress={cancelPasswordRecovery} />
              </>
            ) : (
              <>
                <ResetSteps current={3} />
                <ResetIntro
                  icon="lock-open-outline"
                  title="Choose a new password"
                  message={
                    passwordRecovery.email
                      ? `For ${passwordRecovery.email}. You’ll be signed in once it’s saved.`
                      : 'You’ll be signed in once it’s saved.'
                  }
                />
                <Card style={styles.form} elevated>
                  <View style={styles.group}>
                    <TextField
                      label="New password"
                      icon="lock-closed-outline"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="At least 6 characters"
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      autoFocus
                      error={fieldErrors.password}
                    />
                    {!fieldErrors.password && <PasswordStrength password={password} />}
                  </View>
                  <TextField
                    label="Confirm new password"
                    icon="lock-closed-outline"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Type it again"
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={save}
                    error={fieldErrors.confirm}
                  />
                  {error && <FormError message={error} />}
                  <Button title="Save new password" icon="checkmark" onPress={save} loading={isSaving} />
                </Card>

                <Pressable
                  onPress={cancelPasswordRecovery}
                  disabled={isSaving}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={styles.cancel}>
                  <ThemedText variant="captionStrong" color="textSecondary">
                    Cancel and keep my old password
                  </ThemedText>
                </Pressable>
              </>
            )}
          </EnterItem>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.lg },
  form: { padding: Spacing.xl, gap: Spacing.lg },
  group: { gap: Spacing.sm },
  cancel: { alignSelf: 'center', paddingVertical: Spacing.sm },
});
