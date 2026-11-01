import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown under the field in red. */
  error?: string;
  /** Shown under the field when there is no error. */
  hint?: string;
  /** Small icon inside the field, before the text. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Fixed text before the input, e.g. "@" for usernames. */
  prefix?: string;
};

/**
 * A labeled text input used by the sign-in and sign-up forms. The border turns the
 * accent color while typing, and password fields get a show/hide toggle.
 */
export function TextField({ label, error, hint, icon, prefix, style, secureTextEntry, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.tint : theme.border;

  return (
    <View style={styles.field}>
      <ThemedText variant="label" color={focused ? 'tint' : 'textSecondary'}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.box,
          { backgroundColor: theme.surface, borderColor },
          focused && !error && { boxShadow: `0 0 0 3px ${theme.tintSoft}` },
        ]}>
        {icon && <Ionicons name={icon} size={18} color={focused ? theme.tint : theme.textSecondary} />}
        {prefix && <ThemedText color="textSecondary">{prefix}</ThemedText>}
        <TextInput
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }, style]}
          {...inputProps}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={10}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText variant="caption" color="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    fontFamily: Fonts.medium,
    fontSize: 16,
    outlineWidth: 0, // web: the box's border shows focus instead
  },
});
