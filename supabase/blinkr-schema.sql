-- =============================================================================
-- Blinkr database schema for Supabase (Postgres).
--
-- Run it once in your Supabase project, either:
--   * npm run db:setup          (uses SUPABASE_DB_URL from .env), or
--   * paste this whole file into Supabase Dashboard > SQL Editor > Run.
--
-- It is safe to run again: tables are only created if missing, and functions,
-- views, triggers and policies are replaced.
-- =============================================================================

-- pg_net lets the database send push notifications through Expo's push service.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net is not available, so push notifications will not be sent.';
end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 160),
  location text not null default '' check (char_length(location) <= 50),
  avatar_color text not null default '#2F5597',
  created_at timestamptz not null default now()
);
-- Avatar colors are hex like #1D4ED8 (picked in Edit profile).
alter table public.profiles drop constraint if exists profiles_avatar_color_check;
alter table public.profiles add constraint profiles_avatar_color_check check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');
-- A built-in icon avatar, or a photo you uploaded to your own folder in the avatars bucket
-- (its public URL). Null shows your initials.
-- Keep in step with src/constants/avatars.ts.
alter table public.profiles add column if not exists avatar text;
alter table public.profiles drop constraint if exists profiles_avatar_check;
-- Avatars from an older set (e.g. the emoji ones) fall back to initials.
update public.profiles set avatar = null where avatar is not null and avatar not in ('paw', 'leaf', 'flower', 'planet', 'rocket', 'moon', 'sunny', 'star', 'flame', 'snow', 'musical-notes', 'headset', 'game-controller', 'football', 'basketball', 'bicycle', 'airplane', 'camera', 'cafe', 'pizza', 'fish', 'diamond', 'color-palette', 'trophy') and not (avatar like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%');
alter table public.profiles add constraint profiles_avatar_check check (avatar in ('paw', 'leaf', 'flower', 'planet', 'rocket', 'moon', 'sunny', 'star', 'flame', 'snow', 'musical-notes', 'headset', 'game-controller', 'football', 'basketball', 'bicycle', 'airplane', 'camera', 'cafe', 'pizza', 'fish', 'diamond', 'color-palette', 'trophy') or (avatar like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%'));

-- Blinks are text plus an optional mood. Each one disappears after its lifetime
-- (1 to 72 hours, so at most 3 days). expires_at is set by a trigger, never by the app.
create table if not exists public.blinks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null default '' check (char_length(text) <= 280),
  mood text,
  lifetime_hours smallint not null default 24,
  expires_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

-- Upgrade older databases: stickers became moods, and Blinks gained a lifetime.
alter table public.blinks add column if not exists mood text;
alter table public.blinks add column if not exists lifetime_hours smallint not null default 24;
alter table public.blinks add column if not exists expires_at timestamptz;
alter table public.blinks add column if not exists edited_at timestamptz;
-- Optional photo: a path in the blink-images bucket, always inside the author's own folder.
alter table public.blinks add column if not exists image_path text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'blinks' and column_name = 'sticker'
  ) then
    drop view if exists public.blink_feed;
    alter table public.blinks drop constraint if exists blink_has_content;
    update public.blinks set mood = case sticker
      when 'party' then 'celebrating' when 'fire' then 'excited' when 'love' then 'loved'
      when 'lol' then 'laughing' when 'bravo' then 'celebrating' when 'coffee' then 'chill'
      when 'rocket' then 'motivated' when 'sparkle' then 'happy' when 'growing' then 'grateful'
      when 'running' then 'motivated' when 'snack' then 'hungry' when 'sleepy' then 'tired'
    end
    where sticker is not null and mood is null;
    alter table public.blinks drop column sticker;
  end if;
end $$;
-- Blinks from before lifetimes existed get 3 days from now, rather than vanishing at once.
update public.blinks set expires_at = now() + interval '72 hours' where expires_at is null;

alter table public.blinks drop constraint if exists blinks_mood_check;
alter table public.blinks add constraint blinks_mood_check check (mood in ('happy', 'excited', 'loved', 'grateful', 'chill', 'cool', 'laughing', 'celebrating', 'motivated', 'thoughtful', 'hungry', 'tired', 'sad', 'stressed', 'frustrated', 'unwell'));
alter table public.blinks drop constraint if exists blinks_lifetime_check;
alter table public.blinks add constraint blinks_lifetime_check check (lifetime_hours between 1 and 72);
alter table public.blinks drop constraint if exists blink_has_content;
alter table public.blinks add constraint blink_has_content check (char_length(trim(text)) > 0 or mood is not null or image_path is not null);
alter table public.blinks drop constraint if exists blinks_image_path_check;
alter table public.blinks add constraint blinks_image_path_check check (image_path is null or image_path like author_id::text || '/%');
create index if not exists blinks_created_at_idx on public.blinks (created_at desc);
create index if not exists blinks_author_idx on public.blinks (author_id, created_at desc);
create index if not exists blinks_expires_idx on public.blinks (expires_at);

create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  blink_id uuid not null references public.blinks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blink_id)
);
create index if not exists likes_blink_idx on public.likes (blink_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  blink_id uuid not null references public.blinks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_blink_idx on public.comments (blink_id, created_at);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

-- Closed Blinkers: a private, two-way circle, separate from following/followers.
-- Added only by someone's QR code or user id; the other person accepts or rejects.
-- A row is a pending request until the addressee accepts it. Rejecting deletes it.
create table if not exists public.closed_blinkers (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint no_self_closed_blinker check (requester_id <> addressee_id)
);
-- One row per pair, whichever direction the request went.
create unique index if not exists closed_blinkers_pair_idx
  on public.closed_blinkers (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists closed_blinkers_addressee_idx on public.closed_blinkers (addressee_id);

-- Voice and video calls, only between accepted Closed Blinkers. The audio and video go
-- phone to phone (WebRTC); this table only tracks who called whom and what happened.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles (id) on delete cascade,
  callee_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'missed', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint no_self_call check (caller_id <> callee_id)
);
create index if not exists calls_callee_idx on public.calls (callee_id, created_at desc);
create index if not exists calls_caller_idx on public.calls (caller_id, created_at desc);

-- One conversation per pair of people. user_a is always the smaller id.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversation_order check (user_a < user_b),
  constraint conversation_pair unique (user_a, user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
-- Optional photo: a path in the private message-images bucket, inside the conversation's folder.
-- A photo can be sent on its own, so the text may then be empty.
alter table public.messages add column if not exists image_path text;
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (char_length(text) <= 1000 and (char_length(trim(text)) > 0 or image_path is not null));
alter table public.messages drop constraint if exists messages_image_path_check;
alter table public.messages add constraint messages_image_path_check
  check (image_path is null or image_path like conversation_id::text || '/%');
-- Delivered: the recipient's app received it while open (see mark_messages_delivered). Seen is read_at.
alter table public.messages add column if not exists delivered_at timestamptz;
-- Pinned messages: only in chats between Closed Blinkers (see set_message_pinned).
alter table public.messages add column if not exists pinned_at timestamptz;
alter table public.messages add column if not exists pinned_by uuid references public.profiles (id) on delete set null;
drop index if exists public.messages_one_pin_idx; -- chats used to allow only one pin

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  blink_id uuid references public.blinks (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
alter table public.notifications add column if not exists call_id uuid references public.calls (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'message', 'closed_request', 'closed_accept', 'call'));

-- Expo push tokens, one row per device.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- -----------------------------------------------------------------------------
-- Blink lifetime and edits. The expiry is always created_at + lifetime_hours, so the
-- 3-day limit can't be bypassed; an edit is stamped with edited_at.
-- -----------------------------------------------------------------------------

create or replace function public.blinks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.edited_at := null;
    new.expires_at := new.created_at + make_interval(hours => new.lifetime_hours);
  else
    if new.lifetime_hours is distinct from old.lifetime_hours then
      new.expires_at := old.created_at + make_interval(hours => new.lifetime_hours);
      if new.expires_at <= now() then
        raise exception 'That would make the Blink disappear right away. Pick a longer time.';
      end if;
    end if;
    if new.text is distinct from old.text or new.mood is distinct from old.mood then
      new.edited_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_blink_write on public.blinks;
create trigger on_blink_write before insert or update on public.blinks
  for each row execute function public.blinks_before_write();

-- -----------------------------------------------------------------------------
-- New users get a profile automatically (username and name come from sign-up).
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  colors text[] := array['#B45309', '#0F766E', '#9F1239', '#1D4ED8', '#6D28D9', '#A16207', '#15803D', '#C2410C'];
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  if char_length(base_username) < 3 then
    base_username := base_username || 'user';
  end if;
  base_username := left(base_username, 15);
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    final_username := base_username || floor(random() * 10000)::int;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_color)
  values (
    new.id,
    final_username,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), final_username), 50),
    colors[1 + floor(random() * array_length(colors, 1))::int]
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Views the app reads from. security_invoker = true means row-level security
-- still applies to the person asking.
-- -----------------------------------------------------------------------------

drop view if exists public.blink_feed;
create view public.blink_feed with (security_invoker = true) as
select
  b.id,
  b.author_id,
  b.text,
  b.mood,
  b.lifetime_hours,
  b.expires_at,
  b.edited_at,
  b.created_at,
  b.image_path,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_color as author_avatar_color,
  p.avatar as author_avatar,
  (select count(*) from public.likes l where l.blink_id = b.id)::int as like_count,
  (select count(*) from public.comments c where c.blink_id = b.id)::int as comment_count,
  exists (select 1 from public.likes l where l.blink_id = b.id and l.user_id = auth.uid()) as liked_by_me
from public.blinks b
join public.profiles p on p.id = b.author_id;

drop view if exists public.profile_details;
create view public.profile_details with (security_invoker = true) as
select
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.location,
  p.avatar_color,
  p.avatar,
  p.created_at,
  (select count(*) from public.blinks b where b.author_id = p.id)::int as blink_count,
  (select count(*) from public.follows f where f.following_id = p.id)::int as follower_count,
  (select count(*) from public.follows f where f.follower_id = p.id)::int as following_count,
  exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id) as followed_by_me
from public.profiles p;

drop view if exists public.conversation_list;
create view public.conversation_list with (security_invoker = true) as
select
  c.id,
  c.last_message_at,
  other.id as other_user_id,
  other.username as other_username,
  other.display_name as other_display_name,
  other.avatar_color as other_avatar_color,
  other.avatar as other_avatar,
  coalesce(nullif(trim(last_message.text), ''), case when last_message.image_path is not null then '📷 Photo' end)
    as last_message_text,
  last_message.sender_id as last_message_sender_id,
  (
    select count(*) from public.messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null
  )::int as unread_count
from public.conversations c
join public.profiles other
  on other.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
left join lateral (
  select m.text, m.image_path, m.sender_id from public.messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) last_message on true
where auth.uid() in (c.user_a, c.user_b);

-- -----------------------------------------------------------------------------
-- Functions the app calls (RPC)
-- -----------------------------------------------------------------------------

-- Lets the sign-up screen check a username before the account exists.
create or replace function public.username_available(name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conversation_id uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if other_user_id = me then
    raise exception 'You cannot message yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  insert into public.conversations (user_a, user_b)
  values (least(me, other_user_id), greatest(me, other_user_id))
  on conflict (user_a, user_b) do nothing;

  select c.id into conversation_id
  from public.conversations c
  where c.user_a = least(me, other_user_id) and c.user_b = greatest(me, other_user_id);

  return conversation_id;
end;
$$;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages m
  set read_at = now(), delivered_at = coalesce(m.delivered_at, now())
  where m.conversation_id = target_conversation_id
    and m.sender_id <> auth.uid()
    and m.read_at is null
    and exists (
      select 1 from public.conversations c
      where c.id = target_conversation_id and auth.uid() in (c.user_a, c.user_b)
    );
end;
$$;

-- Called by the recipient's app while it's open: everything sent to you so far has reached you.
create or replace function public.mark_messages_delivered()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages m
  set delivered_at = now()
  from public.conversations c
  where c.id = m.conversation_id
    and auth.uid() in (c.user_a, c.user_b)
    and m.sender_id <> auth.uid()
    and m.delivered_at is null;
end;
$$;

-- Global chat was removed; drop its function from databases set up before that.
drop function if exists public.global_chat_people(text);

-- Closed Blinkers. The app only offers these by QR code or user id; there is no search.
-- Sends a request. If they already asked you, this accepts theirs instead.
-- Returns the resulting status: 'pending' or 'accepted'.
create or replace function public.request_closed_blinker(target_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.closed_blinkers;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if target_id = me then
    raise exception 'You cannot add yourself as a Closed Blinker';
  end if;
  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'No Blinkr user has that id';
  end if;

  select * into existing from public.closed_blinkers
  where least(requester_id, addressee_id) = least(me, target_id)
    and greatest(requester_id, addressee_id) = greatest(me, target_id);

  if found then
    if existing.status = 'pending' and existing.addressee_id = me then
      update public.closed_blinkers set status = 'accepted', responded_at = now()
      where requester_id = target_id and addressee_id = me;
      insert into public.notifications (recipient_id, actor_id, type) values (target_id, me, 'closed_accept');
      return 'accepted';
    end if;
    return existing.status; -- already requested or already Closed Blinkers
  end if;

  insert into public.closed_blinkers (requester_id, addressee_id) values (me, target_id);
  insert into public.notifications (recipient_id, actor_id, type) values (target_id, me, 'closed_request');
  return 'pending';
end;
$$;

-- Accepts or rejects a request someone sent you. Rejecting removes it quietly.
create or replace function public.respond_closed_blinker(requester uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if accept then
    update public.closed_blinkers set status = 'accepted', responded_at = now()
    where requester_id = requester and addressee_id = me and status = 'pending';
    if not found then
      raise exception 'That request no longer exists';
    end if;
    insert into public.notifications (recipient_id, actor_id, type) values (requester, me, 'closed_accept');
  else
    delete from public.closed_blinkers
    where requester_id = requester and addressee_id = me and status = 'pending';
  end if;
end;
$$;

-- Cancels a request you sent, or removes an accepted Closed Blinker (either side can).
create or replace function public.remove_closed_blinker(other_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.closed_blinkers
  where (requester_id = auth.uid() and addressee_id = other_id)
     or (requester_id = other_id and addressee_id = auth.uid() and status = 'accepted');
$$;

-- Calls. Only accepted Closed Blinkers can call each other.
create or replace function public.are_closed_blinkers(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.closed_blinkers c
    where c.status = 'accepted'
      and least(c.requester_id, c.addressee_id) = least(a, b)
      and greatest(c.requester_id, c.addressee_id) = greatest(a, b)
  );
$$;

-- Pins (or unpins) a message. Only in chats between Closed Blinkers; either of the two can do it,
-- and a chat can have several pinned messages.
create or replace function public.set_message_pinned(target_message_id uuid, pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target_conversation public.conversations;
begin
  select c.* into target_conversation
  from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.id = target_message_id;
  if not found or me is null or me not in (target_conversation.user_a, target_conversation.user_b) then
    raise exception 'Message not found';
  end if;
  if not public.are_closed_blinkers(target_conversation.user_a, target_conversation.user_b) then
    raise exception 'Pinning is only available with your Closed Blinkers';
  end if;

  if pinned then
    update public.messages set pinned_at = now(), pinned_by = me
    where id = target_message_id and pinned_at is null;
  else
    update public.messages set pinned_at = null, pinned_by = null where id = target_message_id;
  end if;
end;
$$;

-- Starts ringing someone. Returns the call id; the callee gets a "calling you" push.
create or replace function public.start_call(callee uuid, call_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_call_id uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if callee = me then
    raise exception 'You cannot call yourself';
  end if;
  if call_kind not in ('audio', 'video') then
    raise exception 'Unknown call type';
  end if;
  if not public.are_closed_blinkers(me, callee) then
    raise exception 'Calls are only available with your Closed Blinkers';
  end if;

  -- Anything still ringing after a minute was never answered.
  update public.calls set status = 'missed', ended_at = now()
  where status = 'ringing' and created_at < now() - interval '60 seconds'
    and (caller_id in (me, callee) or callee_id in (me, callee));

  if exists (
    select 1 from public.calls
    where status in ('ringing', 'accepted') and (caller_id = callee or callee_id = callee)
  ) then
    raise exception 'They are on another call right now';
  end if;
  if exists (
    select 1 from public.calls
    where status in ('ringing', 'accepted') and (caller_id = me or callee_id = me)
  ) then
    raise exception 'You are already in a call';
  end if;

  insert into public.calls (caller_id, callee_id, kind) values (me, callee, call_kind)
  returning id into new_call_id;
  insert into public.notifications (recipient_id, actor_id, type, call_id) values (callee, me, 'call', new_call_id);
  return new_call_id;
end;
$$;

-- Moves a call along: the callee accepts or declines, the caller cancels (or gives up:
-- 'missed'), and either side ends an accepted call. Finished calls are left as they are.
create or replace function public.update_call(target_call_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  current_call public.calls;
begin
  select * into current_call from public.calls where id = target_call_id for update;
  if not found or me not in (current_call.caller_id, current_call.callee_id) then
    raise exception 'Call not found';
  end if;
  if current_call.status not in ('ringing', 'accepted') then
    return; -- already over
  end if;

  if current_call.status = 'ringing' and me = current_call.callee_id and new_status in ('accepted', 'declined') then
    update public.calls
    set status = new_status,
        answered_at = case when new_status = 'accepted' then now() end,
        ended_at = case when new_status = 'declined' then now() end
    where id = target_call_id;
  elsif current_call.status = 'ringing' and me = current_call.caller_id and new_status in ('cancelled', 'missed') then
    update public.calls set status = new_status, ended_at = now() where id = target_call_id;
  elsif current_call.status = 'accepted' and new_status = 'ended' then
    update public.calls set status = 'ended', ended_at = now() where id = target_call_id;
  else
    raise exception 'That call change is not allowed';
  end if;
end;
$$;

create or replace function public.register_push_token(push_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.push_tokens (token, user_id, updated_at)
  values (push_token, auth.uid(), now())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(push_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = push_token and user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Triggers: keep conversations sorted, create notifications, send pushes.
-- -----------------------------------------------------------------------------

create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_touch_conversation on public.messages;
create trigger on_message_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

create or replace function public.notify_on_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if tg_table_name = 'likes' then
    select author_id into recipient from public.blinks where id = new.blink_id;
    if recipient is not null and recipient <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, blink_id)
      values (recipient, new.user_id, 'like', new.blink_id);
    end if;
  elsif tg_table_name = 'comments' then
    select author_id into recipient from public.blinks where id = new.blink_id;
    if recipient is not null and recipient <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, blink_id)
      values (recipient, new.author_id, 'comment', new.blink_id);
    end if;
  elsif tg_table_name = 'follows' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  elsif tg_table_name = 'messages' then
    select case when c.user_a = new.sender_id then c.user_b else c.user_a end into recipient
    from public.conversations c where c.id = new.conversation_id;
    if recipient is not null then
      insert into public.notifications (recipient_id, actor_id, type, conversation_id)
      values (recipient, new.sender_id, 'message', new.conversation_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_like_notify on public.likes;
create trigger on_like_notify after insert on public.likes
  for each row execute function public.notify_on_activity();

drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify after insert on public.comments
  for each row execute function public.notify_on_activity();

drop trigger if exists on_follow_notify on public.follows;
create trigger on_follow_notify after insert on public.follows
  for each row execute function public.notify_on_activity();

drop trigger if exists on_message_notify on public.messages;
create trigger on_message_notify after insert on public.messages
  for each row execute function public.notify_on_activity();

-- Sends a push through Expo's push service to every device of the recipient.
create or replace function public.send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  message_body text;
  payload jsonb;
begin
  select display_name into actor_name from public.profiles where id = new.actor_id;

  message_body := case new.type
    when 'like' then actor_name || ' liked your Blink'
    when 'comment' then actor_name || ' commented on your Blink'
    when 'follow' then actor_name || ' started following you'
    when 'message' then actor_name || ' sent you a message'
    when 'closed_request' then actor_name || ' wants to add you as a Closed Blinker'
    when 'closed_accept' then actor_name || ' accepted your Closed Blinker request'
    when 'call' then actor_name || case
      when (select kind from public.calls where id = new.call_id) = 'video' then ' is video calling you'
      else ' is calling you' end
  end;

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', 'Blinkr',
    'body', message_body,
    'sound', 'default',
    'data', jsonb_build_object(
      'type', new.type,
      'blinkId', new.blink_id,
      'conversationId', new.conversation_id,
      'callId', new.call_id,
      'actorId', new.actor_id
    )
  ))
  into payload
  from public.push_tokens t
  where t.user_id = new.recipient_id;

  if payload is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- A failed push must never block the like, comment, follow or message itself.
  raise warning 'Blinkr push notification failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_notification_push on public.notifications;
create trigger on_notification_push after insert on public.notifications
  for each row execute function public.send_push_notification();

-- -----------------------------------------------------------------------------
-- Row-level security: who can read and write what.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.blinks enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.closed_blinkers enable row level security;
alter table public.calls enable row level security;

drop policy if exists "Profiles are visible to signed-in users" on public.profiles;
create policy "Profiles are visible to signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "People update their own profile" on public.profiles;
create policy "People update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Blinks are visible to signed-in users" on public.blinks;
create policy "Blinks are visible to signed-in users" on public.blinks
  for select to authenticated using (expires_at > now()); -- expired Blinks are gone for everyone
drop policy if exists "People post their own Blinks" on public.blinks;
create policy "People post their own Blinks" on public.blinks
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "People edit their own Blinks" on public.blinks;
create policy "People edit their own Blinks" on public.blinks
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "People delete their own Blinks" on public.blinks;
create policy "People delete their own Blinks" on public.blinks
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Likes are visible to signed-in users" on public.likes;
create policy "Likes are visible to signed-in users" on public.likes
  for select to authenticated using (true);
drop policy if exists "People like as themselves" on public.likes;
create policy "People like as themselves" on public.likes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "People remove their own likes" on public.likes;
create policy "People remove their own likes" on public.likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Comments are visible to signed-in users" on public.comments;
create policy "Comments are visible to signed-in users" on public.comments
  for select to authenticated using (true);
drop policy if exists "People comment as themselves" on public.comments;
create policy "People comment as themselves" on public.comments
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "People delete their own comments" on public.comments;
create policy "People delete their own comments" on public.comments
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Follows are visible to signed-in users" on public.follows;
create policy "Follows are visible to signed-in users" on public.follows
  for select to authenticated using (true);
drop policy if exists "People follow as themselves" on public.follows;
create policy "People follow as themselves" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "People unfollow as themselves" on public.follows;
create policy "People unfollow as themselves" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- Conversations are created through get_or_create_conversation(), never directly.
drop policy if exists "Members see their conversations" on public.conversations;
create policy "Members see their conversations" on public.conversations
  for select to authenticated using (auth.uid() in (user_a, user_b));

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
    )
  );
drop policy if exists "Members send messages as themselves" on public.messages;
create policy "Members send messages as themselves" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
        -- Photos only in chats between Closed Blinkers.
        and (image_path is null or public.are_closed_blinkers(c.user_a, c.user_b))
    )
  );

drop policy if exists "People see their own notifications" on public.notifications;
create policy "People see their own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "People mark their own notifications read" on public.notifications;
create policy "People mark their own notifications read" on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Closed Blinkers are private to the two people involved. Changes go through the
-- request/respond/remove functions above, so there are no insert/update/delete policies.
drop policy if exists "Members see their Closed Blinkers" on public.closed_blinkers;
create policy "Members see their Closed Blinkers" on public.closed_blinkers
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));

-- Calls are visible only to the two people on them, and change only through
-- start_call() and update_call().
drop policy if exists "Participants see their calls" on public.calls;
create policy "Participants see their calls" on public.calls
  for select to authenticated using (auth.uid() in (caller_id, callee_id));

-- push_tokens has no policies: it is only reachable through the RPC functions above.

-- -----------------------------------------------------------------------------
-- Grants (explicit, so this works even where default privileges are stricter).
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Editing a Blink can only change what it says, its mood and how long it lasts.
revoke update on public.blinks from authenticated;
grant update (text, mood, lifetime_hours) on public.blinks to authenticated;
-- Edit profile can change these, never the id or join date.
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, location, avatar_color, avatar) on public.profiles to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.mark_messages_delivered() to authenticated;
grant execute on function public.register_push_token(text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.start_call(uuid, text) to authenticated;
grant execute on function public.update_call(uuid, text) to authenticated;
grant execute on function public.set_message_pinned(uuid, boolean) to authenticated;
grant execute on function public.request_closed_blinker(uuid) to authenticated;
grant execute on function public.respond_closed_blinker(uuid, boolean) to authenticated;
grant execute on function public.remove_closed_blinker(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Photo storage: avatars, Blink photos and chat photos (5 MB each, images only).
-- The size limit is enforced by Supabase Storage itself, not just the app.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'No storage schema here, so the photo buckets were skipped.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    -- Public: avatars and Blink photos are shown to everyone signed in, like the rest of a profile or Blink.
    ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
    ('blink-images', 'blink-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
    -- Private: chat photos are only readable by the two people in the chat (through short-lived links).
    ('message-images', 'message-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Avatars and Blink photos: each person writes only inside their own folder ("<user id>/...").
  execute 'drop policy if exists "Blinkr: manage own avatar" on storage.objects';
  execute $p$create policy "Blinkr: manage own avatar" on storage.objects
    for all to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  execute 'drop policy if exists "Blinkr: manage own Blink photos" on storage.objects';
  execute $p$create policy "Blinkr: manage own Blink photos" on storage.objects
    for all to authenticated
    using (bucket_id = 'blink-images' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'blink-images' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  -- Chat photos live in "<conversation id>/...". Both people can see them; only Closed Blinkers can add them.
  execute 'drop policy if exists "Blinkr: chat members see chat photos" on storage.objects';
  execute $p$create policy "Blinkr: chat members see chat photos" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'message-images'
      and exists (
        select 1 from public.conversations c
        where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.user_a, c.user_b)
      )
    )$p$;

  execute 'drop policy if exists "Blinkr: Closed Blinkers send chat photos" on storage.objects';
  execute $p$create policy "Blinkr: Closed Blinkers send chat photos" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'message-images'
      and exists (
        select 1 from public.conversations c
        where c.id::text = (storage.foldername(name))[1]
          and auth.uid() in (c.user_a, c.user_b)
          and public.are_closed_blinkers(c.user_a, c.user_b)
      )
    )$p$;
end $$;

-- Files can only be deleted through the Storage API (deleting their rows in SQL would leave
-- the files behind), so the database asks the API to do it. That needs two secrets in Vault,
-- added once (see README): blinkr_project_url and blinkr_secret_key. Until they exist,
-- deletions wait in this queue and the hourly job below retries them.
create table if not exists public.storage_cleanup (
  id bigserial primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now()
);
alter table public.storage_cleanup enable row level security; -- no policies: the app never touches it

-- Asks Storage to delete one file. False if it couldn't be sent (no secrets yet, no pg_net).
create or replace function public.delete_storage_object(target_bucket text, target_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'blinkr_project_url';
  select decrypted_secret into secret_key from vault.decrypted_secrets where name = 'blinkr_secret_key';
  if base_url is null or secret_key is null then
    return false;
  end if;

  perform net.http_delete(
    url := rtrim(base_url, '/') || '/storage/v1/object/' || target_bucket || '/' || target_path,
    headers := case
      -- New "sb_secret_..." keys go in apikey only; older service_role JWTs also as a bearer token.
      when secret_key like 'sb_%' then jsonb_build_object('apikey', secret_key)
      else jsonb_build_object('apikey', secret_key, 'Authorization', 'Bearer ' || secret_key)
    end
  );
  return true;
exception when others then
  raise warning 'Blinkr could not delete %/%: %', target_bucket, target_path, sqlerrm;
  return false;
end;
$$;

-- Deletes the file now if possible, otherwise queues it for the retry job.
create or replace function public.remove_storage_object(target_bucket text, target_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_path is null or target_path = '' then
    return;
  end if;
  if not public.delete_storage_object(target_bucket, target_path) then
    insert into public.storage_cleanup (bucket, path) values (target_bucket, target_path);
  end if;
end;
$$;

-- Retries queued deletions (hourly, and after you add the Vault secrets).
create or replace function public.process_storage_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  sent integer := 0;
begin
  for item in select * from public.storage_cleanup order by id limit 500 loop
    if public.delete_storage_object(item.bucket, item.path) then
      delete from public.storage_cleanup where id = item.id;
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

-- When a Blink or message goes (deleted, expired, or with its account) its photo goes too;
-- the same for an avatar photo that is replaced or whose account is deleted.
create or replace function public.remove_replaced_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_url text;
begin
  if tg_table_name = 'blinks' then
    if old.image_path is not null and (tg_op = 'DELETE' or new.image_path is distinct from old.image_path) then
      perform public.remove_storage_object('blink-images', old.image_path);
    end if;
  elsif tg_table_name = 'messages' then
    if old.image_path is not null and (tg_op = 'DELETE' or new.image_path is distinct from old.image_path) then
      perform public.remove_storage_object('message-images', old.image_path);
    end if;
  elsif tg_table_name = 'profiles' then
    old_url := old.avatar;
    if old_url like '%/storage/v1/object/public/avatars/%' and (tg_op = 'DELETE' or new.avatar is distinct from old.avatar) then
      perform public.remove_storage_object('avatars', split_part(old_url, '/storage/v1/object/public/avatars/', 2));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists on_blink_photo_removed on public.blinks;
create trigger on_blink_photo_removed after update of image_path or delete on public.blinks
  for each row execute function public.remove_replaced_photo();
drop trigger if exists on_message_photo_removed on public.messages;
create trigger on_message_photo_removed after update of image_path or delete on public.messages
  for each row execute function public.remove_replaced_photo();
drop trigger if exists on_avatar_photo_removed on public.profiles;
create trigger on_avatar_photo_removed after update of avatar or delete on public.profiles
  for each row execute function public.remove_replaced_photo();

-- Internal only: never callable from the app.
revoke execute on function public.delete_storage_object(text, text) from public, anon, authenticated;
revoke execute on function public.remove_storage_object(text, text) from public, anon, authenticated;
revoke execute on function public.process_storage_cleanup() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: live chat messages and notification badges.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calls'
    ) then
      alter publication supabase_realtime add table public.calls; -- incoming calls ring live
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Weekly cleanup: expired Blinks are hidden right away, then permanently deleted
-- (with their likes, comments and notifications) every 7 days.
-- -----------------------------------------------------------------------------

create or replace function public.purge_expired_blinks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.blinks where expires_at <= now();
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
-- Only the database's own scheduler (or an admin) may run it, never the app.
revoke execute on function public.purge_expired_blinks() from public, anon, authenticated;

-- Every Sunday at 03:00 UTC. Scheduling by name replaces the job on re-runs.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('blinkr-purge-expired-blinks', '0 3 * * 0', 'select public.purge_expired_blinks()');
  -- Deleted photos whose files couldn't be removed straight away (see storage_cleanup).
  perform cron.schedule('blinkr-storage-cleanup', '17 * * * *', 'select public.process_storage_cleanup()');
exception when others then
  raise notice 'pg_cron is not available, so expired Blinks will not be deleted automatically. Enable pg_cron (Database > Extensions) and run this file again, or run: select public.purge_expired_blinks();';
end $$;
