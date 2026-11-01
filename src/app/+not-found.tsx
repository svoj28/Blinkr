import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/screen-states';

export default function NotFoundScreen() {
  return (
    <Screen edges={['bottom']}>
      <EmptyState
        icon="compass-outline"
        title="This page doesn’t exist"
        message="The link may be broken. Head back to your Blink feed."
        actionLabel="Go to feed"
        onAction={() => router.navigate('/')}
      />
    </Screen>
  );
}
