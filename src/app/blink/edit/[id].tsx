import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { type BlinkDraft, useBlink, useUpdateBlink } from '@/api/blinks';
import { BlinkComposer, canSubmitDraft } from '@/components/blink-composer';
import { Button } from '@/components/button';
import { Screen, scrollColumn } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/screen-states';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useAuth } from '@/state/auth-context';
import type { Blink } from '@/types';

/** Edit your own Blink: its text, mood, and how long it stays up. Only its author gets here. */
export default function EditBlinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const blink = useBlink(id);

  if (blink.isPending) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState message="Opening Blink…" />
      </Screen>
    );
  }

  if (!blink.data || blink.data.author.id !== userId) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title="You can’t edit this Blink"
          message={blink.data ? 'Only the person who posted a Blink can edit it.' : 'It may have expired or been deleted.'}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return <EditForm blink={blink.data} />;
}

function EditForm({ blink }: { blink: Blink }) {
  const { gutter } = useLayout();
  const updateBlink = useUpdateBlink();
  const [draft, setDraft] = useState<BlinkDraft>({
    text: blink.text,
    mood: blink.mood ?? undefined,
    lifetimeHours: blink.lifetimeHours,
  });

  const hasChanges =
    draft.text.trim() !== blink.text || (draft.mood ?? null) !== blink.mood || draft.lifetimeHours !== blink.lifetimeHours;
  // A Blink with a photo keeps it, so it can have no text or mood.
  const canSave = hasChanges && (canSubmitDraft(draft) || !!blink.imagePath) && !updateBlink.isPending;

  const save = () => {
    if (!canSave) return;
    updateBlink.mutate(
      { id: blink.id, ...draft },
      {
        onSuccess: () => router.back(),
        onError: (error) => Alert.alert('Couldn’t save your changes', error.message),
      }
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title={updateBlink.isPending ? 'Saving…' : 'Save'} icon="checkmark" onPress={save} disabled={!canSave} />
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[scrollColumn, { paddingHorizontal: gutter, paddingVertical: Spacing.lg }]}
          keyboardShouldPersistTaps="handled">
          <BlinkComposer value={draft} onChange={setDraft} author={blink.author} postedAt={blink.createdAt} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
