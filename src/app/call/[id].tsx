import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Call, type CallStatus, updateCall, useCall } from '@/api/calls';
import { Avatar } from '@/components/avatar';
import { CallVideo } from '@/components/call-video';
import { Fonts, Spacing } from '@/constants/theme';
import { RING_TIMEOUT_MS } from '@/lib/call-config';
import { CallSession, type CallMediaState } from '@/lib/call-session';
import { useAuth } from '@/state/auth-context';

// Call screens stay dark in both themes, like the phone's own call screen.
const CALL = {
  background: '#0E1113',
  text: '#F4F2EC',
  muted: 'rgba(244, 242, 236, 0.65)',
  button: 'rgba(255, 255, 255, 0.14)',
  buttonActive: '#F4F2EC',
  accept: '#2F9E62',
  decline: '#E0484E',
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Incoming, ringing, in-call and ended states for one voice or video call. */
export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const call = useCall(id);

  if (call.isPending || !userId) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color={CALL.text} />
      </View>
    );
  }

  if (!call.data) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.status}>This call has ended.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.closeLink}>
          <Text style={styles.closeLinkText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return <CallView call={call.data} myId={userId} />;
}

function CallView({ call, myId }: { call: Call; myId: string }) {
  const role = call.caller.id === myId ? 'caller' : 'callee';
  const other = role === 'caller' ? call.callee : call.caller;
  const isVideo = call.kind === 'video';
  const isActive = call.status === 'ringing' || call.status === 'accepted';

  const sessionRef = useRef<CallSession | null>(null);
  const statusRef = useRef<CallStatus>(call.status);
  statusRef.current = call.status;
  const [media, setMedia] = useState<CallMediaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const session = () => {
    sessionRef.current ??= new CallSession(call.id, role, call.kind, setMedia, () => {
      // They hung up: record it (harmless if their app already did).
      updateCall(call.id, 'ended').catch(() => {});
    });
    return sessionRef.current;
  };

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : 'Something went wrong with the call.');
    const next = statusRef.current === 'ringing' ? (role === 'caller' ? 'cancelled' : 'declined') : 'ended';
    updateCall(call.id, next).catch(() => {});
  };

  // Caller: open the camera/mic and start the ringback as soon as the screen opens.
  useEffect(() => {
    if (role === 'caller' && statusRef.current === 'ringing') session().startRinging().catch(fail);
    // Leaving the screen (e.g. the back button) ends the call.
    return () => {
      sessionRef.current?.close(true);
      CallSession.stopRingtone();
      const status = statusRef.current;
      if (status === 'ringing') updateCall(call.id, role === 'caller' ? 'cancelled' : 'declined').catch(() => {});
      if (status === 'accepted') updateCall(call.id, 'ended').catch(() => {});
    };
    // Runs once for this call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callee: ring while the incoming-call screen is showing.
  useEffect(() => {
    if (role !== 'callee' || call.status !== 'ringing') return;
    CallSession.startRingtone();
    return () => CallSession.stopRingtone();
  }, [role, call.status]);

  // Caller: stop ringing after a while; it counts as missed.
  useEffect(() => {
    if (role !== 'caller' || call.status !== 'ringing') return;
    const timer = setTimeout(() => updateCall(call.id, 'missed').catch(() => {}), RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [role, call.status, call.id]);

  // Call timer.
  useEffect(() => {
    if (call.status !== 'accepted' || !call.answeredAt) return;
    const started = new Date(call.answeredAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.status, call.answeredAt]);

  // Couldn't connect (usually a network that blocks direct calls).
  useEffect(() => {
    if (media?.connection === 'failed' && statusRef.current === 'accepted') {
      fail(new Error('Couldn’t connect the call. One of your networks may block calls. Try Wi-Fi.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.connection]);

  // Call over: release the camera/mic, then close the screen.
  useEffect(() => {
    if (isActive) return;
    sessionRef.current?.close(false);
    CallSession.stopRingtone();
    const timer = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 1800);
    return () => clearTimeout(timer);
  }, [isActive]);

  const accept = async () => {
    setIsAnswering(true);
    try {
      await session().answer(); // asks for camera/mic permission first
      await updateCall(call.id, 'accepted');
    } catch (e) {
      fail(e);
    } finally {
      setIsAnswering(false);
    }
  };

  const decline = () => updateCall(call.id, 'declined').catch(fail);

  const hangUp = () => {
    sessionRef.current?.close(true);
    const next = call.status === 'ringing' ? 'cancelled' : 'ended';
    updateCall(call.id, next).catch(() => {});
  };

  const isIncoming = role === 'callee' && call.status === 'ringing';
  const connected = media?.connection === 'connected';
  const remoteUrl = isVideo && call.status === 'accepted' && !error ? media?.remoteUrl : null;
  // The caller sees their own camera full-screen while it rings.
  const selfFullUrl = isVideo && !remoteUrl && isActive && !media?.cameraOff ? media?.localUrl : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {remoteUrl ? (
        <CallVideo streamURL={remoteUrl} style={StyleSheet.absoluteFill} />
      ) : selfFullUrl ? (
        <CallVideo streamURL={selfFullUrl} mirror={media?.frontCamera} style={[StyleSheet.absoluteFill, styles.dimmed]} />
      ) : null}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {other.displayName}
          </Text>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {statusText(call, role, connected, elapsed)}
          </Text>
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={11} color={CALL.muted} />
            <Text style={styles.badgeText}>Closed Blinker · {isVideo ? 'Video call' : 'Voice call'}</Text>
          </View>
        </View>

        {!remoteUrl && !selfFullUrl && (
          <View style={styles.avatarArea}>
            <Avatar user={other} size={128} />
          </View>
        )}

        {/* Your own camera, small, once the call is up. */}
        {remoteUrl && media?.localUrl && !media.cameraOff && (
          <View style={styles.selfView}>
            <CallVideo streamURL={media.localUrl} mirror={media.frontCamera} onTop style={StyleSheet.absoluteFill} />
          </View>
        )}

        <View style={styles.bottom}>
          {error && <Text style={styles.error}>{error}</Text>}

          {isIncoming ? (
            <View style={styles.answerRow}>
              <CallButton icon="close" label="Decline" tone="decline" onPress={decline} large />
              <CallButton
                icon={isVideo ? 'videocam' : 'call'}
                label={isAnswering ? 'Connecting…' : 'Accept'}
                tone="accept"
                onPress={accept}
                disabled={isAnswering}
                large
              />
            </View>
          ) : isActive ? (
            <View style={styles.controls}>
              <CallButton
                icon={media?.muted ? 'mic-off' : 'mic'}
                label={media?.muted ? 'Unmute' : 'Mute'}
                active={media?.muted}
                onPress={() => sessionRef.current?.toggleMute()}
              />
              <CallButton
                icon={media?.speakerOn ? 'volume-high' : 'volume-medium'}
                label="Speaker"
                active={media?.speakerOn}
                onPress={() => sessionRef.current?.toggleSpeaker()}
              />
              {isVideo && (
                <CallButton
                  icon={media?.cameraOff ? 'videocam-off' : 'videocam'}
                  label={media?.cameraOff ? 'Camera on' : 'Camera off'}
                  active={media?.cameraOff}
                  onPress={() => sessionRef.current?.toggleCamera()}
                />
              )}
              {isVideo && (
                <CallButton icon="camera-reverse" label="Flip" onPress={() => sessionRef.current?.switchCamera()} />
              )}
              <CallButton icon="call" label="End" tone="decline" onPress={hangUp} rotateIcon />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function statusText(call: Call, role: 'caller' | 'callee', connected: boolean, elapsed: number): string {
  switch (call.status) {
    case 'ringing':
      return role === 'caller' ? 'Calling…' : `Incoming ${call.kind === 'video' ? 'video' : 'voice'} call`;
    case 'accepted':
      return connected ? formatDuration(elapsed) : 'Connecting…';
    case 'declined':
      return role === 'caller' ? 'Call declined' : 'You declined';
    case 'missed':
      return role === 'caller' ? 'No answer' : 'Missed call';
    case 'cancelled':
      return role === 'caller' ? 'Call cancelled' : 'Missed call';
    case 'ended':
      return elapsed > 0 ? `Call ended · ${formatDuration(elapsed)}` : 'Call ended';
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

type CallButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'accept' | 'decline';
  /** Toggled on (e.g. muted): shown as a light button. */
  active?: boolean;
  large?: boolean;
  disabled?: boolean;
  /** Turns the phone icon into the "hang up" handset. */
  rotateIcon?: boolean;
};

function CallButton({ icon, label, onPress, tone, active = false, large = false, disabled = false, rotateIcon }: CallButtonProps) {
  const size = large ? 76 : 60;
  const background = tone === 'accept' ? CALL.accept : tone === 'decline' ? CALL.decline : active ? CALL.buttonActive : CALL.button;
  const color = !tone && active ? CALL.background : '#FFFFFF';

  return (
    <View style={styles.buttonWrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled }}
        style={({ pressed }) => [
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
          styles.button,
          { opacity: disabled ? 0.6 : pressed ? 0.8 : 1 },
        ]}>
        <Ionicons
          name={icon}
          size={large ? 32 : 26}
          color={color}
          style={rotateIcon ? { transform: [{ rotate: '135deg' }] } : undefined}
        />
      </Pressable>
      <Text style={styles.buttonLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CALL.background },
  center: { flex: 1, backgroundColor: CALL.background, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  dimmed: { opacity: 0.55 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl, gap: 6 },
  name: { color: CALL.text, fontFamily: Fonts.serifBold, fontSize: 32, lineHeight: 38 },
  status: { color: CALL.muted, fontFamily: Fonts.medium, fontSize: 16, textAlign: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs },
  badgeText: { color: CALL.muted, fontFamily: Fonts.semibold, fontSize: 12, letterSpacing: 0.3 },
  avatarArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selfView: {
    position: 'absolute',
    right: Spacing.lg,
    top: 150,
    width: 104,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#000000',
  },
  bottom: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  error: { color: '#FFB4B0', fontFamily: Fonts.medium, fontSize: 14, textAlign: 'center' },
  answerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', rowGap: Spacing.md },
  buttonWrap: { alignItems: 'center', gap: 6, minWidth: 64 },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: CALL.text, fontFamily: Fonts.medium, fontSize: 12 },
  closeLink: { padding: Spacing.md },
  closeLinkText: { color: CALL.text, fontFamily: Fonts.bold, fontSize: 16 },
});
