import { useQuery } from '@tanstack/react-query';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/*
 * Photos: avatars, Blink photos and chat photos (Closed Blinkers only). Each is at most 5 MB.
 * The buckets enforce the limit too (see supabase/blinkr-schema.sql); checking here first
 * just gives a friendly message instead of a failed upload.
 */

export type ImageBucket = 'avatars' | 'blink-images' | 'message-images';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type PickedImage = {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  /** In bytes, when the picker knows it. */
  size?: number;
};

export class ImageTooLargeError extends Error {
  constructor(bytes: number) {
    super(`That photo is ${(bytes / 1024 / 1024).toFixed(1)} MB. Photos can be up to 5 MB.`);
  }
}

/**
 * False in an app build made before the photo picker was added: its native code isn't inside.
 * (The picker is loaded only when used, so such a build still runs; picking explains what to do.)
 */
export const canPickImages = Platform.OS === 'web' || requireOptionalNativeModule('ExponentImagePicker') !== null;

/**
 * Opens the photo library and returns the chosen photo, or null if cancelled.
 * `square` lets you crop it (for avatars). Throws ImageTooLargeError over 5 MB.
 */
export async function pickImage({ square = false }: { square?: boolean } = {}): Promise<PickedImage | null> {
  if (!canPickImages) {
    throw new Error(
      'This copy of Blinkr was built before photo uploads were added. Install the latest build of the app to add photos.'
    );
  }
  const ImagePicker = await import('expo-image-picker');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    // Keeps most phone photos well under the limit without visible loss.
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) throw new ImageTooLargeError(asset.fileSize);
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
    size: asset.fileSize,
  };
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** A new, unguessable file name inside `folder` (a user or conversation id). */
export function newImagePath(folder: string, image: PickedImage): string {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${folder}/${id}.${EXTENSIONS[image.mimeType] ?? 'jpg'}`;
}

/** Uploads the photo to `path` in `bucket`. Throws ImageTooLargeError over 5 MB. */
export async function uploadImage(bucket: ImageBucket, path: string, image: PickedImage): Promise<void> {
  const data = await (await fetch(image.uri)).arrayBuffer();
  if (data.byteLength > MAX_IMAGE_BYTES) throw new ImageTooLargeError(data.byteLength);

  const { error } = await supabase.storage.from(bucket).upload(path, data, { contentType: image.mimeType });
  if (error) {
    if (/exceeded|too large|payload/i.test(error.message)) throw new ImageTooLargeError(data.byteLength);
    throw error;
  }
}

/** Deletes an uploaded photo (best effort: the database also cleans up when things are deleted). */
export async function removeImage(bucket: ImageBucket, path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

/** Address of a photo in a public bucket (avatars, Blink photos). */
export function publicImageUrl(bucket: 'avatars' | 'blink-images', path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const SIGNED_URL_SECONDS = 60 * 60;

/** A short-lived address for a private chat photo; only the two people in the chat can get one. */
export function useSignedImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-image', path],
    enabled: !!path,
    // Refresh well before the link runs out.
    staleTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('message-images').createSignedUrl(path!, SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
