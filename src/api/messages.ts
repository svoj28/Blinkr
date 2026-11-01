import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currentUserId, type MessageRow, toConversationPreview, toMessage } from '@/api/rows';
import { newImagePath, type PickedImage, removeImage, uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';

export const messageKeys = {
  inbox: ['conversations'] as const,
  conversation: (id: string) => ['conversations', id] as const,
  /** Newest first, to suit the chat's inverted list. */
  messages: (conversationId: string) => ['messages', conversationId] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: messageKeys.inbox,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_list')
        .select('*')
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data.map(toConversationPreview);
    },
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: messageKeys.conversation(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('conversation_list').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? toConversationPreview(data) : null;
    },
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: messageKeys.messages(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data.map(toMessage);
    },
  });
}

/** What you send: text, a photo (Closed Blinkers only), or both. */
export type OutgoingMessage = { text: string; image?: PickedImage | null };

/** Sends a message. It shows up straight away as "Sending…" and becomes "Sent" once stored. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const key = messageKeys.messages(conversationId);
  return useMutation({
    mutationFn: async ({ text, image }: OutgoingMessage) => {
      // Chat photos live in the conversation's folder of the private bucket.
      const imagePath = image ? newImagePath(conversationId, image) : null;
      if (image && imagePath) await uploadImage('message-images', imagePath, image);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: await currentUserId(),
          text: text.trim(),
          image_path: imagePath,
        })
        .select()
        .single();
      if (error) {
        await removeImage('message-images', imagePath).catch(() => {});
        throw error;
      }
      return toMessage(data as MessageRow);
    },
    onMutate: async ({ text, image }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const placeholder: Message = {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conversationId,
        senderId: await currentUserId(),
        text: text.trim(),
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        pinnedAt: null,
        pending: true,
        imagePath: null,
        localImageUri: image?.uri,
      };
      queryClient.setQueryData<Message[]>(key, (current) => (current ? [placeholder, ...current] : current));
      return { placeholderId: placeholder.id };
    },
    onSuccess: (message, _sent, context) => {
      // Swap the placeholder for the stored message (realtime may have delivered it already).
      queryClient.setQueryData<Message[]>(key, (current) => {
        if (!current) return current;
        const rest = current.filter((m) => m.id !== message.id);
        const at = rest.findIndex((m) => m.id === context?.placeholderId);
        if (at === -1) return current.some((m) => m.id === message.id) ? current : [message, ...current];
        return [...rest.slice(0, at), message, ...rest.slice(at + 1)];
      });
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox, exact: true });
    },
    onError: (_error, _sent, context) => {
      queryClient.setQueryData<Message[]>(key, (current) => current?.filter((m) => m.id !== context?.placeholderId));
    },
  });
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.rpc('mark_conversation_read', { target_conversation_id: conversationId });
  if (error) throw error;
}

/** Tells senders their messages reached you. Called while the app is open (see useRealtimeUpdates). */
export async function markMessagesDelivered() {
  const { error } = await supabase.rpc('mark_messages_delivered');
  if (error) throw error;
}

/** Returns the id of the conversation with this person, creating it the first time. */
export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: otherUserId });
  if (error) throw error;
  return data as string;
}

/** Pins or unpins a message. Only works in chats between Closed Blinkers (the database checks this). */
export function usePinMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const key = messageKeys.messages(conversationId);
  return useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('set_message_pinned', { target_message_id: messageId, pinned });
      if (error) throw error;
    },
    onMutate: async ({ messageId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<Message[]>(key);
      const pinnedAt = pinned ? new Date().toISOString() : null;
      queryClient.setQueryData<Message[]>(key, (current) =>
        current?.map((m) => (m.id === messageId ? { ...m, pinnedAt } : m))
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Replaces a message in an open chat's cache (read receipts, pins). */
export function updateMessageInCache(queryClient: ReturnType<typeof useQueryClient>, message: Message) {
  queryClient.setQueryData<Message[]>(messageKeys.messages(message.conversationId), (current) =>
    current?.map((m) => (m.id === message.id ? message : m))
  );
}

/** Adds a message to an open chat's cache (skipping duplicates from realtime). */
export function addMessageToCache(queryClient: ReturnType<typeof useQueryClient>, message: Message) {
  queryClient.setQueryData<Message[]>(messageKeys.messages(message.conversationId), (current) => {
    if (!current) return current;
    if (current.some((m) => m.id === message.id)) return current;
    // Your own message arriving by realtime before the send finished: it replaces its placeholder.
    const placeholder = current.findIndex((m) => m.pending && m.senderId === message.senderId && m.text === message.text);
    if (placeholder !== -1) return current.map((m, i) => (i === placeholder ? message : m));
    return [message, ...current];
  });
}
