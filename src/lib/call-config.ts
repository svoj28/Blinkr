/**
 * Network settings for calls. Calls connect phone to phone (WebRTC), which is free and
 * has no usage limits. Google's public STUN servers help the two phones find each other.
 *
 * Some networks (strict mobile carriers, offices) block direct connections. For those,
 * add a TURN relay server in .env (for example a self-hosted coturn):
 *   EXPO_PUBLIC_TURN_URL=turn:turn.example.com:3478   (several: comma-separated)
 *   EXPO_PUBLIC_TURN_USERNAME=...
 *   EXPO_PUBLIC_TURN_CREDENTIAL=...
 */
const turnUrls = (process.env.EXPO_PUBLIC_TURN_URL ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

export const iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ...(turnUrls.length > 0
    ? [
        {
          urls: turnUrls,
          username: process.env.EXPO_PUBLIC_TURN_USERNAME?.trim(),
          credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL?.trim(),
        },
      ]
    : []),
];

/** How long a call rings before it counts as missed. */
export const RING_TIMEOUT_MS = 45_000;
