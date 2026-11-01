import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  closedBlinkerQrValue,
  parseClosedBlinkerCode,
  useClosedBlinkers,
  useRequestClosedBlinker,
} from '@/api/closed-blinkers';
import { useProfile } from '@/api/profiles';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QrCode } from '@/components/qr-code';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { UnderlineTabs } from '@/components/underline-tabs';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/state/auth-context';

type Mode = 'mine' | 'scan' | 'uid';

const MODES: { key: Mode; label: string }[] = [
  { key: 'mine', label: 'My QR' },
  { key: 'scan', label: 'Scan QR' },
  { key: 'uid', label: 'Enter UID' },
];

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The only ways into someone's Closed Blinkers: their QR code or their UID.
 * Shows your own code, scans someone else's, or takes a typed UID, then sends a request.
 */
export default function AddClosedBlinkerScreen() {
  const { gutter } = useLayout();
  const [mode, setMode] = useState<Mode>('mine');
  const [candidateId, setCandidateId] = useState<string | null>(null);

  const changeMode = (next: Mode) => {
    setMode(next);
    setCandidateId(null);
  };

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
          <UnderlineTabs tabs={MODES} active={mode} onChange={changeMode} />

          {candidateId ? (
            <Candidate userId={candidateId} onDone={() => setCandidateId(null)} />
          ) : mode === 'mine' ? (
            <MyCode />
          ) : mode === 'scan' ? (
            <Scanner onFound={setCandidateId} />
          ) : (
            <EnterUid onFound={setCandidateId} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Your QR code and UID, for someone else to scan or type. */
function MyCode() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { gutter } = useLayout();
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId);
  if (!userId) return null;

  const qrSize = Math.min(240, Math.min(width, MaxContentWidth) - gutter * 2 - 64);

  const shareUid = () => {
    const name = profile ? `${profile.displayName} (@${profile.username})` : 'me';
    Share.share({
      message: `Add ${name} as a Closed Blinker on Blinkr. My UID: ${userId}`,
    }).catch(() => {});
  };

  return (
    <View style={styles.stack}>
      <Card style={styles.qrCard}>
        {profile && (
          <View style={styles.identity}>
            <Avatar user={profile} size={36} />
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong" numberOfLines={1}>
                {profile.displayName}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                @{profile.username}
              </ThemedText>
            </View>
          </View>
        )}
        {/* White frame = the quiet zone scanners need, in light and dark mode. */}
        <View style={styles.qrFrame}>
          <QrCode value={closedBlinkerQrValue(userId)} size={qrSize} accessibilityLabel="Your Closed Blinker QR code" />
        </View>
        <ThemedText variant="caption" color="textSecondary" style={styles.center}>
          Let someone scan this to send you a Closed Blinker request.
        </ThemedText>
      </Card>

      <Card style={styles.uidCard}>
        <ThemedText variant="label" color="textSecondary">
          Your UID
        </ThemedText>
        <Text selectable style={[styles.uid, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}>
          {userId}
        </Text>
        <Button title="Share UID" icon="share-outline" variant="secondary" onPress={shareUid} />
      </Card>
    </View>
  );
}

/** Camera view that reads a Blinkr QR code. */
function Scanner({ onFound }: { onFound: (userId: string) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const lastInvalid = useRef('');

  if (!permission) {
    return <ActivityIndicator color={theme.tint} style={styles.loading} />;
  }

  if (!permission.granted) {
    return (
      <Card style={styles.permission}>
        <View style={[styles.permissionIcon, { backgroundColor: theme.tintSoft }]}>
          <Ionicons name="camera-outline" size={26} color={theme.tint} />
        </View>
        <ThemedText variant="heading" style={styles.center}>
          Scan a Blinkr QR code
        </ThemedText>
        <ThemedText color="textSecondary" style={styles.center}>
          Blinkr needs your camera to read their code. Nothing is recorded or saved.
        </ThemedText>
        {permission.canAskAgain ? (
          <Button title="Allow camera" icon="camera-outline" onPress={requestPermission} />
        ) : (
          <Button title="Open settings" icon="settings-outline" variant="secondary" onPress={() => Linking.openSettings()} />
        )}
      </Card>
    );
  }

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const id = parseClosedBlinkerCode(data);
    if (id) return onFound(id);
    // The camera reports the same code many times a second; only react once.
    if (lastInvalid.current !== data) {
      lastInvalid.current = data;
      setError('That isn’t a Blinkr QR code. Ask them to open Closed Blinkers → Add → My QR.');
    }
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.cameraWrap, { borderColor: theme.border }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
        <View pointerEvents="none" style={styles.viewfinder}>
          <View style={styles.viewfinderBox} />
        </View>
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger" accessibilityRole="alert" style={styles.center}>
          {error}
        </ThemedText>
      ) : (
        <ThemedText variant="caption" color="textSecondary" style={styles.center}>
          Point your camera at their Blinkr QR code.
        </ThemedText>
      )}
    </View>
  );
}

/** A typed or pasted UID. */
function EnterUid({ onFound }: { onFound: (userId: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  const find = () => {
    const id = parseClosedBlinkerCode(value);
    if (!id) return setError('A UID looks like 1a2b3c4d-1234-5678-9abc-1234567890ab.');
    setError(undefined);
    onFound(id);
  };

  return (
    <Card style={styles.uidCard}>
      <TextField
        label="Their UID"
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(undefined);
        }}
        placeholder="Paste or type their UID"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="search"
        onSubmitEditing={find}
        error={error}
        hint="They can find it under Closed Blinkers → Add → My QR."
      />
      <Button title="Find" icon="search" onPress={find} disabled={value.trim().length === 0} />
    </Card>
  );
}

/** Who the code belongs to, and a button to send them a request. */
function Candidate({ userId: candidateId, onDone }: { userId: string; onDone: () => void }) {
  const theme = useTheme();
  const { userId } = useAuth();
  const profile = useProfile(candidateId);
  const lists = useClosedBlinkers(userId);
  const request = useRequestClosedBlinker();

  const isMe = candidateId === userId;
  const existing =
    lists.data?.accepted.find((r) => r.user.id === candidateId) ??
    lists.data?.incoming.find((r) => r.user.id === candidateId) ??
    lists.data?.outgoing.find((r) => r.user.id === candidateId);

  const status: string | null = request.data
    ? request.data === 'accepted'
      ? 'You’re now Closed Blinkers.'
      : 'Request sent. They’ll be able to accept or reject it.'
    : isMe
      ? 'That’s your own code.'
      : existing?.status === 'accepted'
        ? 'Already one of your Closed Blinkers.'
        : existing?.direction === 'outgoing'
          ? 'You’ve already sent them a request.'
          : existing?.direction === 'incoming'
            ? 'They’ve already asked you. Sending a request accepts theirs.'
            : null;

  const canSend = !isMe && !request.data && existing?.status !== 'accepted' && existing?.direction !== 'outgoing';

  if (profile.isPending) return <ActivityIndicator color={theme.tint} style={styles.loading} />;

  if (!profile.data) {
    return (
      <Card style={styles.permission}>
        <Ionicons name="help-circle-outline" size={32} color={theme.textSecondary} />
        <ThemedText variant="heading" style={styles.center}>
          No one found
        </ThemedText>
        <ThemedText color="textSecondary" style={styles.center}>
          No Blinkr account has that UID. Check it and try again.
        </ThemedText>
        <Button title="Try again" variant="secondary" onPress={onDone} />
      </Card>
    );
  }

  return (
    <Card style={styles.candidate}>
      <Avatar user={profile.data} size={72} />
      <View style={styles.candidateNames}>
        <ThemedText variant="title" style={[styles.center, styles.candidateName]} numberOfLines={2}>
          {profile.data.displayName}
        </ThemedText>
        <ThemedText color="textSecondary">@{profile.data.username}</ThemedText>
      </View>

      {status && (
        <ThemedText
          variant="captionStrong"
          color={request.data ? 'tint' : 'textSecondary'}
          style={styles.center}
          accessibilityRole={request.data ? 'alert' : undefined}>
          {status}
        </ThemedText>
      )}
      {request.error && (
        <ThemedText variant="caption" color="danger" accessibilityRole="alert" style={styles.center}>
          {request.error.message}
        </ThemedText>
      )}

      <View style={styles.candidateActions}>
        {canSend && (
          <Button
            title={request.isPending ? 'Sending…' : existing?.direction === 'incoming' ? 'Accept their request' : 'Send request'}
            icon="lock-closed-outline"
            onPress={() => request.mutate(candidateId)}
            disabled={request.isPending}
          />
        )}
        <Button title={request.data ? 'Add someone else' : 'Back'} variant="secondary" onPress={onDone} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  stack: { gap: Spacing.md },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  loading: { paddingVertical: Spacing.xxl },
  qrCard: { alignItems: 'center', padding: Spacing.lg, gap: Spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' },
  qrFrame: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: Radius.md },
  uidCard: { padding: Spacing.lg, gap: Spacing.md },
  uid: {
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 20,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  permission: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  permissionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  cameraWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  viewfinder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  viewfinderBox: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  candidate: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  candidateNames: { alignItems: 'center', gap: 2 },
  candidateName: { fontSize: 26, lineHeight: 32 },
  candidateActions: { alignSelf: 'stretch', gap: Spacing.sm, paddingTop: Spacing.sm },
});
