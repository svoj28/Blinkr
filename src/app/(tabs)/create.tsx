import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { type BlinkDraft, useCreateBlink } from '@/api/blinks';
import { useProfile } from '@/api/profiles';
import { AppHeader } from '@/components/app-header';
import { BlinkComposer, canSubmitDraft } from '@/components/blink-composer';
import { Button } from '@/components/button';
import { Screen, scrollColumn } from '@/components/screen';
import { DefaultLifetimeHours } from '@/constants/moods';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useAuth } from '@/state/auth-context';

const EMPTY_DRAFT: BlinkDraft = { text: '', mood: undefined, lifetimeHours: DefaultLifetimeHours, image: null };

export default function CreateBlinkScreen() {
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const { data: me } = useProfile(userId);
  const createBlink = useCreateBlink();
  const [draft, setDraft] = useState<BlinkDraft>(EMPTY_DRAFT);

  const canPost = canSubmitDraft(draft) && !createBlink.isPending;

  const postBlink = () => {
    if (!canPost) return;
    createBlink.mutate(draft, {
      onSuccess: () => {
        setDraft(EMPTY_DRAFT);
        Keyboard.dismiss();
        router.navigate('/'); // The new Blink appears at the top of the feed.
      },
      onError: (error) => Alert.alert('Couldn’t post your Blink', error.message),
    });
  };

  return (
    <Screen>
      <AppHeader
        title="New Blink"
        right={
          <Button
            title={createBlink.isPending ? 'Posting…' : 'Post'}
            icon="paper-plane-outline"
            onPress={postBlink}
            disabled={!canPost}
          />
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          // Extra room at the end so the last options clear the tab bar when scrolled down.
          contentContainerStyle={[scrollColumn, { paddingHorizontal: gutter, paddingBottom: Spacing.xxl * 2 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator>
          <BlinkComposer value={draft} onChange={setDraft} author={me} allowPhoto />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
