import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EnterItem } from '@/components/motion';
import { FormError, ResetIntro, ResetSteps } from '@/components/reset-flow';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import { friendlyAuthError } from '@/utils/auth-errors';

/** How long before another email can be requested (Supabase refuses sooner anyway). */
const RESEND_SECONDS = 60;

/**
 * Forgot password: enter your email and we send a reset link. Opening it brings you back
 * to the app's reset-password screen to choose a new password.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const theme = useTheme();
  const { gutter } = useLayout();
  const headerHeight = useHeaderHeight();
  const { sendPasswordResetEmail } = useAuth();

  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const send = async () => {
    if (isBusy) return;
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailError('Enter the email you signed up with.');
      return;
    }
    setEmailError(undefined);
    setError(null);
    setIsBusy(true);
    try {
      await sendPasswordResetEmail(trimmed);
      setSentTo(trimmed);
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setIsBusy(false);
    }
  };

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
            {!sentTo ? (
              <>
                <ResetSteps current={1} />
                <ResetIntro
                  icon="key-outline"
                  title="Forgot your password?"
                  message="It happens. Tell us the email on your account and we’ll send you a link to choose a new one."
                />
                <Card style={styles.form} elevated>
                  <TextField
                    label="Email"
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={send}
                    error={emailError}
                    autoFocus={!params.email}
                  />
                  {error && <FormError message={error} />}
                  <Button title="Send reset link" icon="paper-plane-outline" onPress={send} loading={isBusy} />
                </Card>
              </>
            ) : (
              <>
                <ResetSteps current={2} />
                <ResetIntro
                  icon="mail-open-outline"
                  title="Check your email"
                  message={`If ${sentTo} has a Blinkr account, a reset link is on its way.`}
                />

                <Card style={styles.form} elevated>
                  <Instruction n={1} text="Open the email titled “Reset your password”." />
                  <Instruction n={2} text="Tap “Reset password”. Open it on this device so Blinkr opens." />
                  <Instruction n={3} text="Choose your new password. You’ll be signed straight in." />
                  {error && <FormError message={error} />}
                </Card>

                <View style={styles.links}>
                  <Pressable
                    onPress={send}
                    disabled={resendIn > 0 || isBusy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: resendIn > 0 || isBusy }}
                    hitSlop={8}>
                    <ThemedText variant="captionStrong" color={resendIn > 0 ? 'textSecondary' : 'tint'}>
                      {resendIn > 0 ? `Resend link in ${resendIn}s` : 'Resend link'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSentTo(null);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <ThemedText variant="captionStrong" color="tint">
                      Use a different email
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={[styles.tip, { borderColor: theme.border }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
                  <ThemedText variant="caption" color="textSecondary" style={styles.flex}>
                    Can’t find it? Check your spam or promotions folder. Each link works once, for an hour, and only
                    the newest one works.
                  </ThemedText>
                </View>

                <Button title="Back to sign in" variant="secondary" icon="arrow-back" onPress={() => router.back()} />
              </>
            )}
          </EnterItem>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** One numbered line of "what to do next". */
function Instruction({ n, text }: { n: number; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.instruction}>
      <View style={[styles.number, { borderColor: theme.tint }]}>
        <ThemedText style={[styles.numberText, { color: theme.tint }]}>{n}</ThemedText>
      </View>
      <ThemedText style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.lg },
  form: { padding: Spacing.xl, gap: Spacing.lg },
  instruction: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  number: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 16 },
  links: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingHorizontal: Spacing.xs },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  flex: { flex: 1 },
});
