import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { isUsernameAvailable } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/screen';
import { PasswordStrength } from '@/components/password-strength';
import { EmptyState } from '@/components/screen-states';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';
import { friendlyAuthError } from '@/utils/auth-errors';

type FieldErrors = Partial<Record<'displayName' | 'username' | 'email' | 'password', string>>;

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function SignUpScreen() {
  const theme = useTheme();
  const { gutter } = useLayout();
  const { signUp } = useAuth();
  const headerHeight = useHeaderHeight();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!displayName.trim()) next.displayName = 'Add the name people will see.';
    if (!USERNAME_PATTERN.test(username)) next.username = '3–20 characters: lowercase letters, numbers or _.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Use at least 6 characters.';
    return next;
  };

  const submit = async () => {
    if (isSubmitting) return;
    const fieldErrors = validate();
    setErrors(fieldErrors);
    setFormError(null);
    if (Object.keys(fieldErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (!(await isUsernameAvailable(username))) {
        setErrors({ username: `@${username} is taken. Try another.` });
        return;
      }
      const { needsEmailConfirmation } = await signUp({ email, password, username, displayName });
      // Without email confirmation the person is signed in and the app opens automatically.
      if (needsEmailConfirmation) setConfirmationSentTo(email.trim());
    } catch (e) {
      setFormError(friendlyAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmationSentTo) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="mail-unread-outline"
          title="Check your email"
          message={`We sent a confirmation link to ${confirmationSentTo}. Open it, then come back and sign in.`}
          actionLabel="Back to sign in"
          onAction={() => router.back()}
        />
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
            <View style={styles.intro}>
              <ThemedText variant="label" color="tint">
                New reader
              </ThemedText>
              <ThemedText variant="title">Join Blinkr</ThemedText>
              <ThemedText variant="italic" color="textSecondary">
                Post Blinks, follow people and send messages. It takes a minute.
              </ThemedText>
            </View>

            {/* How you'll appear, filled in as you type. Your color is picked when the account is made. */}
            <Card style={styles.preview}>
              <Avatar user={{ displayName: displayName.trim() || '?', avatarColor: theme.tint }} size={48} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong" numberOfLines={1} color={displayName.trim() ? 'text' : 'textSecondary'}>
                  {displayName.trim() || 'Your name'}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                  @{username || 'username'}
                </ThemedText>
              </View>
              <ThemedText variant="label" color="textSecondary">
                Preview
              </ThemedText>
            </Card>

            <Card style={styles.form} elevated>
              <ThemedText variant="label" color="textSecondary">
                Your profile
              </ThemedText>
              <TextField
                label="Name"
                icon="person-outline"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Maya Chen"
                autoComplete="name"
                textContentType="name"
                maxLength={50}
                error={errors.displayName}
              />
              <TextField
                label="Username"
                prefix="@"
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase().replace(/\s/g, ''))}
                placeholder="mayachen"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                maxLength={20}
                error={errors.username}
                hint="Lowercase letters, numbers and _."
              />

              <View style={[styles.rule, { backgroundColor: theme.border }]} />

              <ThemedText variant="label" color="textSecondary">
                Sign-in details
              </ThemedText>
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
                error={errors.email}
              />
              <View style={styles.passwordGroup}>
                <TextField
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  error={errors.password}
                />
                {!errors.password && <PasswordStrength password={password} />}
              </View>

              {formError && (
                <ThemedText variant="caption" color="danger" accessibilityRole="alert">
                  {formError}
                </ThemedText>
              )}
              <Button
                title={isSubmitting ? 'Creating account…' : 'Create account'}
                icon="arrow-forward"
                onPress={submit}
                loading={isSubmitting}
              />
            </Card>

            <Pressable onPress={() => router.back()} accessibilityRole="link" style={styles.link}>
              <ThemedText color="textSecondary">
                Already have an account? <ThemedText variant="bodyStrong" color="tint">Sign in</ThemedText>
              </ThemedText>
            </Pressable>
          </EnterItem>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.lg },
  intro: { gap: Spacing.xs },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  form: { padding: Spacing.xl, gap: Spacing.lg },
  rule: { height: StyleSheet.hairlineWidth * 2, marginVertical: Spacing.xs },
  passwordGroup: { gap: Spacing.sm },
  link: { alignSelf: 'center', paddingVertical: Spacing.sm },
});
