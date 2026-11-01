import { CardTones } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Returns an accent color for a key (usually a user id), used for the slim edge on
 * Blink cards. The same person always gets the same color.
 */
export function useTone(key: string): string {
  const tones = CardTones[useColorScheme()];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return tones[hash % tones.length];
}
