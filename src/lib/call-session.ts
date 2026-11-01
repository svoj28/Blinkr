import { NativeModules } from 'react-native';
// Type-only imports: erased at build time, so they never load the native modules by themselves.
import type * as WebRTC from 'react-native-webrtc';
import type InCallManagerType from 'react-native-incall-manager';

import { iceServers } from '@/lib/call-config';
import { supabase } from '@/lib/supabase';

/*
 * One voice or video call, phone to phone (WebRTC). The two phones agree on how to
 * connect by sending small "signal" messages over a Supabase Realtime channel named after
 * the call; the audio and video themselves never touch Supabase.
 *
 *   callee accepts → subscribes → sends "ready"
 *   caller gets "ready" → sends an "offer"; callee replies with an "answer"
 *   both trickle "ice" candidates (network routes) until the connection is up
 *   either side sends "hangup" when they end the call
 *
 * The native modules are loaded lazily so an older app build (without them) shows a
 * friendly message instead of crashing.
 */

type Signal =
  | { type: 'ready' }
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'ice'; candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } }
  | { type: 'hangup' };

export type CallRole = 'caller' | 'callee';
export type CallKind = 'audio' | 'video';

export type CallMediaState = {
  localUrl: string | null;
  remoteUrl: string | null;
  /** WebRTC connection state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'. */
  connection: string;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  frontCamera: boolean;
};

type Modules = { webrtc: typeof WebRTC; inCall: typeof InCallManagerType };
let modules: Modules | null | undefined;

function loadModules(): Modules | null {
  if (modules !== undefined) return modules;
  // Check for the native code first: on an app build made before calls were added,
  // merely importing react-native-webrtc throws (and shows a red error in development).
  if (!NativeModules.WebRTCModule || !NativeModules.InCallManager) {
    modules = null;
    return modules;
  }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    modules = {
      webrtc: require('react-native-webrtc') as typeof WebRTC,
      inCall: (require('react-native-incall-manager') as { default: typeof InCallManagerType }).default,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    modules = null;
  }
  return modules;
}

/** False on app builds made before calls were added (they lack the native call code). */
export function callsSupported(): boolean {
  return loadModules() !== null;
}

export const CALLS_UNSUPPORTED_MESSAGE =
  'Calls need the latest version of Blinkr. Install the newest build of the app to call.';

export class CallSession {
  private pc: WebRTC.RTCPeerConnection | null = null;
  private localStream: WebRTC.MediaStream | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private pendingCandidates: Signal[] = [];
  private closed = false;
  private state: CallMediaState;

  constructor(
    private readonly callId: string,
    private readonly role: CallRole,
    private readonly kind: CallKind,
    private readonly onChange: (state: CallMediaState) => void,
    /** The other person hung up (or their app closed the call). */
    private readonly onRemoteHangup: () => void
  ) {
    this.state = {
      localUrl: null,
      remoteUrl: null,
      connection: 'new',
      muted: false,
      cameraOff: false,
      speakerOn: kind === 'video',
      frontCamera: true,
    };
  }

  private set(changes: Partial<CallMediaState>) {
    if (this.closed) return;
    this.state = { ...this.state, ...changes };
    this.onChange(this.state);
  }

  /** Caller: before the other person answers (camera preview + ringback tone). */
  async startRinging() {
    const mods = this.require();
    await this.openMedia();
    mods.inCall.start({ media: this.kind, ringback: '_DTMF_' });
    this.applySpeaker();
    this.subscribe();
  }

  /** Callee: after tapping Accept. */
  async answer() {
    const mods = this.require();
    mods.inCall.stopRingtone();
    await this.openMedia();
    mods.inCall.start({ media: this.kind });
    this.applySpeaker();
    this.subscribe();
  }

  /** Callee: plays the ringtone while the incoming-call screen is up. */
  static startRingtone() {
    loadModules()?.inCall.startRingtone('_DEFAULT_', [0, 800, 600], 'playback', 45);
  }

  static stopRingtone() {
    loadModules()?.inCall.stopRingtone();
  }

  toggleMute() {
    const muted = !this.state.muted;
    this.localStream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
    this.set({ muted });
  }

  toggleCamera() {
    const cameraOff = !this.state.cameraOff;
    this.localStream?.getVideoTracks().forEach((track) => (track.enabled = !cameraOff));
    this.set({ cameraOff });
  }

  switchCamera() {
    this.localStream?.getVideoTracks().forEach((track) => track._switchCamera());
    this.set({ frontCamera: !this.state.frontCamera });
  }

  toggleSpeaker() {
    this.set({ speakerOn: !this.state.speakerOn });
    this.applySpeaker();
  }

  /** Stops everything. Pass notifyOther to tell the other phone right away. */
  close(notifyOther: boolean) {
    if (this.closed) return;
    if (notifyOther) this.send({ type: 'hangup' });
    this.closed = true;
    const mods = loadModules();
    mods?.inCall.stopRingback();
    mods?.inCall.stop();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream?.release();
    this.pc?.close();
    if (this.channel) supabase.removeChannel(this.channel);
    this.pc = null;
    this.localStream = null;
    this.channel = null;
  }

  // --- internals ---

  private require(): Modules {
    const mods = loadModules();
    if (!mods) throw new Error(CALLS_UNSUPPORTED_MESSAGE);
    return mods;
  }

  private applySpeaker() {
    loadModules()?.inCall.setForceSpeakerphoneOn(this.state.speakerOn);
  }

  private async openMedia() {
    const { webrtc } = this.require();
    const stream = await webrtc.mediaDevices.getUserMedia({
      audio: true,
      video: this.kind === 'video' ? { facingMode: 'user', width: 1280, height: 720, frameRate: 30 } : false,
    });
    if (this.closed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.localStream = stream;
    this.set({ localUrl: this.kind === 'video' ? stream.toURL() : null });

    const pc = new webrtc.RTCPeerConnection({ iceServers });
    this.pc = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // The library's event typings are loose, so the event shapes are spelled out here.
    pc.onicecandidate = (event: unknown) => {
      const { candidate } = event as unknown as { candidate: WebRTC.RTCIceCandidate | null };
      if (candidate) this.send({ type: 'ice', candidate: candidate.toJSON() });
    };
    pc.ontrack = (event: unknown) => {
      const { streams } = event as unknown as { streams: WebRTC.MediaStream[] };
      if (streams[0]) this.set({ remoteUrl: streams[0].toURL() });
    };
    pc.onconnectionstatechange = () => {
      const connection = pc.connectionState;
      if (connection === 'connected') loadModules()?.inCall.stopRingback();
      this.set({ connection });
    };
  }

  private subscribe() {
    const channel = supabase.channel(`call-${this.callId}`, { config: { broadcast: { self: false } } });
    this.channel = channel;
    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        this.handle(payload as Signal).catch(() => this.set({ connection: 'failed' }));
      })
      .subscribe((status) => {
        // The callee announces it's ready; the caller then sends the offer.
        if (status === 'SUBSCRIBED' && this.role === 'callee') this.send({ type: 'ready' });
      });
  }

  private send(signal: Signal) {
    this.channel?.send({ type: 'broadcast', event: 'signal', payload: signal }).catch(() => {});
  }

  private async handle(signal: Signal) {
    const pc = this.pc;
    if (!pc || this.closed) return;
    const { webrtc } = this.require();

    switch (signal.type) {
      case 'ready': {
        if (this.role !== 'caller') return;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: this.kind === 'video' });
        await pc.setLocalDescription(offer);
        this.send({ type: 'offer', sdp: offer.sdp });
        return;
      }
      case 'offer': {
        if (this.role !== 'callee') return;
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        await this.flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({ type: 'answer', sdp: answer.sdp });
        return;
      }
      case 'answer': {
        if (this.role !== 'caller') return;
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        await this.flushCandidates();
        return;
      }
      case 'ice': {
        // Candidates can arrive before the offer/answer; hold them until then.
        if (!pc.remoteDescription) {
          this.pendingCandidates.push(signal);
          return;
        }
        await pc.addIceCandidate(new webrtc.RTCIceCandidate(signal.candidate));
        return;
      }
      case 'hangup':
        this.onRemoteHangup();
        return;
    }
  }

  private async flushCandidates() {
    const { webrtc } = this.require();
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const signal of queued) {
      if (signal.type === 'ice') await this.pc?.addIceCandidate(new webrtc.RTCIceCandidate(signal.candidate));
    }
  }
}
