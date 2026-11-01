import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/state/auth-context';
import { friendlyAuthError } from '@/utils/auth-errors';

type SignInFormProps = {
  submitLabel?: string;
  /** Called after a successful sign-in. */
  onSignedIn?: () => void;
  /** Shows a "Forgot password?" link; gets whatever email has been typed so far. */
  onForgotPassword?: (email: string) => void;
};

/** Email + password card, used on sign-in and on "Add an account". */
export function SignInForm({ submitLabel = 'Sign in', onSignedIn, onForgotPassword }: SignInFormProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !isSubmitting;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      onSignedIn?.();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
        returnKeyType="next"
      />
      <View style={styles.passwordGroup}>
        <TextField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {onForgotPassword && (
          <Pressable
            onPress={() => onForgotPassword(email.trim())}
            accessibilityRole="link"
            hitSlop={8}
            style={styles.forgot}>
            <ThemedText variant="captionStrong" color="tint">
              Forgot password?
            </ThemedText>
          </Pressable>
        )}
      </View>
      {error && (
        <ThemedText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
      <Button
        title={isSubmitting ? 'Signing in…' : submitLabel}
        icon="arrow-forward"
        onPress={submit}
        disabled={!canSubmit && !isSubmitting}
        loading={isSubmitting}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.xl, gap: Spacing.lg },
  passwordGroup: { gap: Spacing.sm },
  forgot: { alignSelf: 'flex-end' },
});
