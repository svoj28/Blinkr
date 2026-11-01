// Calls are phone-only (the WebRTC module Blinkr uses is for iOS and Android).
// This stub keeps the web build working and explains why calls aren't offered.

export type CallRole = 'caller' | 'callee';
export type CallKind = 'audio' | 'video';

export type CallMediaState = {
  localUrl: string | null;
  remoteUrl: string | null;
  connection: string;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  frontCamera: boolean;
};

export function callsSupported(): boolean {
  return false;
}

export const CALLS_UNSUPPORTED_MESSAGE = 'Calls are available in the Blinkr app for iPhone and Android.';

export class CallSession {
  constructor(
    _callId: string,
    _role: CallRole,
    _kind: CallKind,
    _onChange: (state: CallMediaState) => void,
    _onRemoteHangup: () => void
  ) {}

  async startRinging(): Promise<void> {
    throw new Error(CALLS_UNSUPPORTED_MESSAGE);
  }

  async answer(): Promise<void> {
    throw new Error(CALLS_UNSUPPORTED_MESSAGE);
  }

  static startRingtone() {}
  static stopRingtone() {}
  toggleMute() {}
  toggleCamera() {}
  switchCamera() {}
  toggleSpeaker() {}
  close(_notifyOther: boolean) {}
}
