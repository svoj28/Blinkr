// Tests supabase/blinkr-schema.sql without a real Supabase project.
// Runs it on an in-memory Postgres (PGlite) with a small stand-in for Supabase's auth schema,
// then checks the main flows and the row-level security rules.   Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schema = readFileSync(fileURLToPath(new URL('../supabase/blinkr-schema.sql', import.meta.url)), 'utf8');
const db = new PGlite();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

// --- Supabase stand-ins -------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;

  -- A small stand-in for Supabase Storage: buckets, objects with row-level security, foldername().
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner_id text default auth.uid()::text
  );
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`);

// --- Run the schema twice (it must be re-runnable) ------------------------------
try {
  await db.exec(schema);
  check('schema runs', true);
} catch (e) {
  check('schema runs', false, e.message);
  process.exit(1);
}
try {
  await db.exec(schema);
  check('schema runs a second time (idempotent)', true);
} catch (e) {
  check('schema runs a second time (idempotent)', false, e.message);
}

// --- Users ---------------------------------------------------------------------
const mk = async (email, meta) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta])).rows[0].id;
const maya = await mk('maya@example.com', { username: 'mayachen', display_name: 'Maya Chen' });
const jordan = await mk('jordan@example.com', { username: 'MayaChen', display_name: 'Jordan Rivera' }); // clashing username
const sam = await mk('sam.o@example.com', {}); // no metadata at all

const profiles = (await db.query(`select id, username, display_name from public.profiles order by created_at`)).rows;
check('profiles auto-created for every new user', profiles.length === 3, JSON.stringify(profiles.map((p) => p.username)));
check('clashing username gets a unique suffix', new Set(profiles.map((p) => p.username)).size === 3);
check('user without metadata gets username from email', profiles.some((p) => p.username === 'samo'));

// Run a function as a signed-in user (RLS applies).
async function as(userId, fn) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
  }
}
async function expectError(name, fn) {
  try {
    await fn();
    check(name, false, 'expected an error');
  } catch (e) {
    check(name, true, e.message.split('\n')[0]);
  }
}

// --- Edit profile ------------------------------------------------------------------
const editedProfile = await as(sam, async () =>
  (await db.query(
    `update public.profiles set display_name = 'Sam O', username = 'sam_o', bio = 'Hi!', location = 'Lisbon', avatar_color = '#0F766E'
     where id = $1 returning username`, [sam])).rows
);
check('people can edit their own profile', editedProfile.length === 1 && editedProfile[0].username === 'sam_o');
const otherEdit = await as(sam, async () =>
  (await db.query(`update public.profiles set bio = 'hacked' where id = $1 returning id`, [maya])).rows
);
check("cannot edit someone else's profile", otherEdit.length === 0);
await expectError('username must be unique', () =>
  as(sam, () => db.query(`update public.profiles set username = 'mayachen' where id = $1`, [sam]))
);
await expectError('avatar color must be a hex color', () =>
  as(sam, () => db.query(`update public.profiles set avatar_color = 'red' where id = $1`, [sam]))
);
await as(sam, () => db.query(`update public.profiles set avatar = 'rocket' where id = $1`, [sam]));
const samAvatar = await as(maya, async () => (await db.query(`select avatar from public.profile_details where id = $1`, [sam])).rows[0].avatar);
check('people can pick a built-in avatar (shown to others)', samAvatar === 'rocket');
await expectError('only built-in avatars are allowed', () =>
  as(sam, () => db.query(`update public.profiles set avatar = 'https://example.com/me.png' where id = $1`, [sam]))
);
await expectError('the old emoji avatars are no longer allowed', () =>
  as(sam, () => db.query(`update public.profiles set avatar = 'fox' where id = $1`, [sam]))
);
await expectError('cannot change the profile join date', () =>
  as(sam, () => db.query(`update public.profiles set created_at = now() - interval '5 years' where id = $1`, [sam]))
);

// --- Blinks ----------------------------------------------------------------------
const blinkId = await as(maya, async () =>
  (await db.query(`insert into public.blinks (author_id, text, mood) values ($1, 'Hello Blinkr #first', 'celebrating') returning id`, [maya])).rows[0].id
);
check('user can post a Blink', !!blinkId);

await expectError('cannot post a Blink as someone else', () =>
  as(jordan, () => db.query(`insert into public.blinks (author_id, text) values ($1, 'spoof')`, [maya]))
);
await expectError('cannot post an empty Blink', () =>
  as(maya, () => db.query(`insert into public.blinks (author_id, text) values ($1, '   ')`, [maya]))
);
await expectError('cannot use an unknown mood', () =>
  as(maya, () => db.query(`insert into public.blinks (author_id, text, mood) values ($1, 'x', 'unicorn')`, [maya]))
);
const stickerOnly = await as(maya, async () =>
  (await db.query(`insert into public.blinks (author_id, mood) values ($1, 'chill') returning id`, [maya])).rows[0].id
);
check('mood-only Blink is allowed', !!stickerOnly);

// --- Lifetime (max 3 days), expiry and edits --------------------------------------------
const life = await as(maya, async () =>
  (await db.query(
    `insert into public.blinks (author_id, text, lifetime_hours, expires_at) values ($1, 'Short one', 6, now() + interval '1 year')
     returning extract(epoch from (expires_at - created_at))::int / 3600 as hours`, [maya])).rows[0].hours
);
check('expiry is created_at + lifetime (the app cannot set its own)', life === 6, String(life));
const defaultLife = await as(maya, async () =>
  (await db.query(`select lifetime_hours from public.blinks where id = $1`, [blinkId])).rows[0].lifetime_hours
);
check('Blinks last 24 hours by default', defaultLife === 24);
await expectError('a Blink cannot last more than 3 days', () =>
  as(maya, () => db.query(`insert into public.blinks (author_id, text, lifetime_hours) values ($1, 'too long', 73)`, [maya]))
);
const doomed = await as(maya, async () =>
  (await db.query(`insert into public.blinks (author_id, text) values ($1, 'Soon gone') returning id`, [maya])).rows[0].id
);
await db.query(`update public.blinks set expires_at = now() - interval '1 minute' where id = $1`, [doomed]);
const seenExpired = await as(jordan, async () => (await db.query(`select count(*)::int as n from public.blink_feed where id = $1`, [doomed])).rows[0].n);
check('expired Blinks disappear from the feed', seenExpired === 0);
const authorSeesExpired = await as(maya, async () => (await db.query(`select count(*)::int as n from public.blinks where id = $1`, [doomed])).rows[0].n);
check('expired Blinks are hidden from their author too', authorSeesExpired === 0);

const edited = await as(maya, async () =>
  (await db.query(`update public.blinks set text = 'Hello again #first', mood = 'happy' where id = $1 returning edited_at`, [blinkId])).rows
);
check('author can edit their Blink (marked as edited)', edited.length === 1 && edited[0].edited_at !== null);
const hijack = await as(jordan, async () =>
  (await db.query(`update public.blinks set text = 'hacked' where id = $1 returning id`, [blinkId])).rows
);
check("cannot edit someone else's Blink", hijack.length === 0);
await expectError('cannot move a Blink to another author', () =>
  as(maya, () => db.query(`update public.blinks set author_id = $1 where id = $2`, [jordan, blinkId]))
);
await expectError('cannot shorten a Blink so it expires in the past', () =>
  as(maya, async () => {
    await db.query(`reset role`);
    await db.query(`update public.blinks set created_at = now() - interval '5 hours' where id = $1`, [blinkId]);
    await db.query(`set role authenticated`);
    await db.query(`update public.blinks set lifetime_hours = 2 where id = $1`, [blinkId]);
  })
);

// --- Weekly purge of expired Blinks -------------------------------------------------------
const oldOne = await as(maya, async () =>
  (await db.query(`insert into public.blinks (author_id, text) values ($1, 'Old news') returning id`, [maya])).rows[0].id
);
await as(jordan, () => db.query(`insert into public.likes (user_id, blink_id) values ($1, $2)`, [jordan, oldOne]));
await db.query(`update public.blinks set expires_at = now() - interval '1 day' where id = $1`, [oldOne]);
await expectError('the app cannot run the purge', () => as(maya, () => db.query(`select public.purge_expired_blinks()`)));
const purged = (await db.query(`select public.purge_expired_blinks() as n`)).rows[0].n;
const leftovers = (await db.query(
  `select (select count(*) from public.blinks where id = any($1::uuid[]))::int as blinks,
          (select count(*) from public.likes where blink_id = $2)::int as likes`, [[doomed, oldOne], oldOne])).rows[0];
check('purge permanently deletes expired Blinks and their likes', purged === 2 && leftovers.blinks === 0 && leftovers.likes === 0,
  JSON.stringify({ purged, ...leftovers }));
const survivors = (await db.query(`select count(*)::int as n from public.blinks where id = any($1::uuid[])`, [[blinkId, stickerOnly]])).rows[0].n;
check('purge keeps Blinks that have not expired', survivors === 2);

// --- Likes & comments --------------------------------------------------------------
await as(jordan, () => db.query(`insert into public.likes (user_id, blink_id) values ($1, $2)`, [jordan, blinkId]));
await as(jordan, () => db.query(`insert into public.comments (blink_id, author_id, text) values ($1, $2, 'Nice!')`, [blinkId, jordan]));
await as(maya, () => db.query(`insert into public.likes (user_id, blink_id) values ($1, $2)`, [maya, blinkId])); // self-like

const feedForJordan = await as(jordan, async () => (await db.query(`select * from public.blink_feed where id = $1`, [blinkId])).rows[0]);
check('feed view counts likes and comments', feedForJordan.like_count === 2 && feedForJordan.comment_count === 1,
  `likes=${feedForJordan.like_count} comments=${feedForJordan.comment_count}`);
check('feed view knows the viewer liked it', feedForJordan.liked_by_me === true);
check('feed view includes author name', feedForJordan.author_display_name === 'Maya Chen');
const feedForSam = await as(sam, async () => (await db.query(`select liked_by_me from public.blink_feed where id = $1`, [blinkId])).rows[0]);
check('liked_by_me is false for someone who did not like it', feedForSam.liked_by_me === false);

await expectError('cannot like as someone else', () =>
  as(sam, () => db.query(`insert into public.likes (user_id, blink_id) values ($1, $2)`, [jordan, stickerOnly]))
);
const deleted = await as(jordan, async () => (await db.query(`delete from public.blinks where id = $1 returning id`, [blinkId])).rows);
check("cannot delete someone else's Blink", deleted.length === 0);

// --- Follows & profile details ------------------------------------------------------
await as(jordan, () => db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [jordan, maya]));
await expectError('cannot follow yourself', () =>
  as(maya, () => db.query(`insert into public.follows (follower_id, following_id) values ($1, $1)`, [maya]))
);
const mayaDetails = await as(jordan, async () => (await db.query(`select * from public.profile_details where id = $1`, [maya])).rows[0]);
check('profile details: counts and followed_by_me',
  // 3 live Blinks; the expired one isn't counted.
  mayaDetails.blink_count === 3 && mayaDetails.follower_count === 1 && mayaDetails.followed_by_me === true,
  JSON.stringify({ b: mayaDetails.blink_count, f: mayaDetails.follower_count, me: mayaDetails.followed_by_me }));

// --- Notifications -------------------------------------------------------------------
const mayaNotifs = await as(maya, async () => (await db.query(`select type from public.notifications order by created_at`)).rows.map((r) => r.type));
check('like, comment and follow notify the author (not self-like)', JSON.stringify(mayaNotifs) === JSON.stringify(['like', 'comment', 'follow']), JSON.stringify(mayaNotifs));
const samSeesMaya = await as(sam, async () => (await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n);
check("cannot read other people's notifications", samSeesMaya === 0);
await as(maya, () => db.query(`update public.notifications set read_at = now() where read_at is null`));
const unread = (await db.query(`select count(*)::int as n from public.notifications where recipient_id = $1 and read_at is null`, [maya])).rows[0].n;
check('user can mark their notifications read', unread === 0);

// --- Messages -------------------------------------------------------------------------
const convId = await as(jordan, async () => (await db.query(`select public.get_or_create_conversation($1) as id`, [maya])).rows[0].id);
const convAgain = await as(maya, async () => (await db.query(`select public.get_or_create_conversation($1) as id`, [jordan])).rows[0].id);
check('conversation is shared by both people (no duplicates)', convId && convId === convAgain);

await as(jordan, () => db.query(`insert into public.messages (conversation_id, sender_id, text) values ($1, $2, 'Hey Maya!')`, [convId, jordan]));
await as(jordan, () => db.query(`insert into public.messages (conversation_id, sender_id, text) values ($1, $2, 'Are you free later?')`, [convId, jordan]));

const mayaInbox = await as(maya, async () => (await db.query(`select * from public.conversation_list`)).rows);
check('inbox shows the conversation with unread count and last message',
  mayaInbox.length === 1 && mayaInbox[0].unread_count === 2 && mayaInbox[0].last_message_text === 'Are you free later?' &&
    mayaInbox[0].other_display_name === 'Jordan Rivera',
  JSON.stringify(mayaInbox[0] && { unread: mayaInbox[0].unread_count, last: mayaInbox[0].last_message_text }));

const samInbox = await as(sam, async () => (await db.query(`select * from public.conversation_list`)).rows);
const samMessages = await as(sam, async () => (await db.query(`select * from public.messages`)).rows);
check("outsiders can't see the conversation or its messages", samInbox.length === 0 && samMessages.length === 0);
await expectError("outsiders can't post into a conversation", () =>
  as(sam, () => db.query(`insert into public.messages (conversation_id, sender_id, text) values ($1, $2, 'hi')`, [convId, sam]))
);

const statusOf = async () =>
  as(jordan, async () => (await db.query(`select delivered_at is not null as delivered, read_at is not null as seen from public.messages where conversation_id = $1`, [convId])).rows);
check('new messages start as sent (not delivered or seen)', (await statusOf()).every((r) => !r.delivered && !r.seen));
await as(jordan, () => db.query(`select public.mark_messages_delivered()`));
check("the sender cannot mark their own messages delivered", (await statusOf()).every((r) => !r.delivered));
await as(sam, () => db.query(`select public.mark_messages_delivered()`));
check("outsiders cannot mark someone else's messages delivered", (await statusOf()).every((r) => !r.delivered));
await as(maya, () => db.query(`select public.mark_messages_delivered()`));
check('the recipient marks messages delivered', (await statusOf()).every((r) => r.delivered && !r.seen));
await expectError('messages cannot be marked delivered directly', () =>
  as(maya, async () => {
    const r = await db.query(`update public.messages set delivered_at = null where conversation_id = $1 returning id`, [convId]);
    if (r.rows.length === 0) throw new Error('no rows updated');
  })
);

await as(maya, () => db.query(`select public.mark_conversation_read($1)`, [convId]));
check('reading marks messages seen', (await statusOf()).every((r) => r.delivered && r.seen));
const afterRead = await as(maya, async () => (await db.query(`select unread_count from public.conversation_list`)).rows[0].unread_count);
check('marking a conversation read clears the unread count', afterRead === 0);
const jordanUnread = await as(jordan, async () => (await db.query(`select unread_count from public.conversation_list`)).rows[0].unread_count);
check("sender's own messages never count as unread", jordanUnread === 0);

const msgNotif = await as(maya, async () => (await db.query(`select count(*)::int as n from public.notifications where type = 'message'`)).rows[0].n);
check('each message creates a notification for the recipient', msgNotif === 2);

await expectError('cannot message yourself', () =>
  as(maya, () => db.query(`select public.get_or_create_conversation($1)`, [maya]))
);

// --- Push tokens -------------------------------------------------------------------------
await as(maya, () => db.query(`select public.register_push_token('ExponentPushToken[abc]')`));
await as(jordan, () => db.query(`select public.register_push_token('ExponentPushToken[abc]')`)); // same phone, new user
const owner = (await db.query(`select user_id from public.push_tokens where token = 'ExponentPushToken[abc]'`)).rows[0].user_id;
check('push token moves to whoever signs in on that phone', owner === jordan);
const tokensVisible = await as(jordan, async () => {
  try {
    return (await db.query(`select * from public.push_tokens`)).rows.length;
  } catch {
    return 0;
  }
});
check('push tokens are not readable directly', tokensVisible === 0);
// A notification insert must still succeed even though pg_net is missing here.
await as(sam, () => db.query(`insert into public.likes (user_id, blink_id) values ($1, $2)`, [sam, stickerOnly]));
check('activity still works when a push cannot be sent', true);

// --- Closed Blinkers (separate from follows; added by id, accepted or rejected) -------------
const closedRows = async () => (await db.query(`select requester_id, addressee_id, status from public.closed_blinkers`)).rows;
const rpc = (userId, sql, params) => as(userId, async () => (await db.query(sql, params)).rows[0]);

const first = await rpc(maya, `select public.request_closed_blinker($1) as s`, [sam]);
check('closed blinker request starts pending', first.s === 'pending');
const again = await rpc(maya, `select public.request_closed_blinker($1) as s`, [sam]);
check('requesting twice does not duplicate', again.s === 'pending' && (await closedRows()).length === 1);
const samNotif = (await db.query(`select type from public.notifications where recipient_id = $1 and type like 'closed%'`, [sam])).rows;
check('addressee is notified of the request', samNotif.length === 1 && samNotif[0].type === 'closed_request');
const jordanSees = await as(jordan, async () => (await db.query(`select count(*)::int as n from public.closed_blinkers`)).rows[0].n);
check('outsiders cannot see Closed Blinkers', jordanSees === 0);
await expectError('Closed Blinkers cannot be inserted directly', () =>
  as(jordan, () => db.query(`insert into public.closed_blinkers (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [jordan, maya]))
);
await expectError('cannot add yourself as a Closed Blinker', () => rpc(maya, `select public.request_closed_blinker($1)`, [maya]));
await expectError('unknown id is rejected', () => rpc(maya, `select public.request_closed_blinker(gen_random_uuid())`));
await expectError('requester cannot accept their own request', () =>
  rpc(maya, `select public.respond_closed_blinker($1, true)`, [sam])
);

await rpc(sam, `select public.respond_closed_blinker($1, false)`, [maya]);
check('reject removes the request', (await closedRows()).length === 0);

await rpc(maya, `select public.request_closed_blinker($1)`, [sam]);
await rpc(sam, `select public.respond_closed_blinker($1, true)`, [maya]);
const accepted = await closedRows();
check('accept makes them Closed Blinkers', accepted.length === 1 && accepted[0].status === 'accepted');
const mayaAccept = (await db.query(`select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'closed_accept'`, [maya])).rows[0].n;
check('requester is notified when accepted', mayaAccept === 1);
const followsUntouched = (await db.query(`select count(*)::int as n from public.follows where (follower_id, following_id) in (($1::uuid, $2::uuid), ($2::uuid, $1::uuid))`, [maya, sam])).rows[0].n;
check('Closed Blinkers do not create follows', followsUntouched === 0);

await rpc(jordan, `select public.request_closed_blinker($1)`, [sam]);
const crossed = await rpc(sam, `select public.request_closed_blinker($1) as s`, [jordan]);
check('requesting someone who already asked you accepts their request', crossed.s === 'accepted');

await rpc(sam, `select public.remove_closed_blinker($1)`, [maya]);
check('either side can remove a Closed Blinker', (await closedRows()).length === 1);

// --- Calls (Closed Blinkers only) ------------------------------------------------------------
// jordan and sam are Closed Blinkers here; maya and jordan are not.
const callId = await rpc(jordan, `select public.start_call($1, 'video') as id`, [sam]).then((r) => r.id);
check('Closed Blinkers can start a call', !!callId);
const ring = (await db.query(`select type from public.notifications where recipient_id = $1 and call_id = $2`, [sam, callId])).rows;
check('the callee is notified (push) that they are being called', ring.length === 1 && ring[0].type === 'call');
await expectError('only Closed Blinkers can call each other', () => rpc(maya, `select public.start_call($1, 'audio')`, [jordan]));
await expectError('cannot call yourself', () => rpc(jordan, `select public.start_call($1, 'audio')`, [jordan]));
await expectError('unknown call type is rejected', () => rpc(sam, `select public.start_call($1, 'hologram')`, [jordan]));
const mayaSeesCall = await as(maya, async () => (await db.query(`select count(*)::int as n from public.calls`)).rows[0].n);
check('outsiders cannot see calls', mayaSeesCall === 0);
await expectError('cannot start a second call while one is ringing', () => rpc(sam, `select public.start_call($1, 'audio')`, [jordan]));
await expectError('the caller cannot answer their own call', () => rpc(jordan, `select public.update_call($1, 'accepted')`, [callId]));
await rpc(sam, `select public.update_call($1, 'accepted')`, [callId]);
await rpc(jordan, `select public.update_call($1, 'ended')`, [callId]);
const endedCall = (await db.query(`select status, answered_at is not null as answered, ended_at is not null as ended from public.calls where id = $1`, [callId])).rows[0];
check('a call can be answered and then hung up', endedCall.status === 'ended' && endedCall.answered && endedCall.ended, JSON.stringify(endedCall));
const declinedId = await rpc(sam, `select public.start_call($1, 'audio') as id`, [jordan]).then((r) => r.id);
await rpc(jordan, `select public.update_call($1, 'declined')`, [declinedId]);
const declined = (await db.query(`select status from public.calls where id = $1`, [declinedId])).rows[0].status;
check('the callee can decline', declined === 'declined');
await expectError('calls are not writable directly', () =>
  as(jordan, () => db.query(`insert into public.calls (caller_id, callee_id, kind) values ($1, $2, 'audio')`, [jordan, maya]))
);

// --- Pinned messages (Closed Blinkers only, several per chat) --------------------------------------
const closedConv = await rpc(jordan, `select public.get_or_create_conversation($1) as id`, [sam]).then((r) => r.id);
const say = (userId, conv, text) =>
  rpc(userId, `insert into public.messages (conversation_id, sender_id, text) values ($1, $2, $3) returning id`, [conv, userId, text]).then((r) => r.id);
const pinA = await say(jordan, closedConv, 'Meet at 7');
const pinB = await say(sam, closedConv, 'Bring snacks');
const pinnedIn = async (userId, conv) =>
  as(userId, async () => (await db.query(`select id, pinned_by from public.messages where conversation_id = $1 and pinned_at is not null`, [conv])).rows);
await rpc(sam, `select public.set_message_pinned($1, true)`, [pinA]);
let pins = await pinnedIn(jordan, closedConv);
check('Closed Blinkers can pin a message (both see it)', pins.length === 1 && pins[0].id === pinA && pins[0].pinned_by === sam);
await rpc(jordan, `select public.set_message_pinned($1, true)`, [pinB]);
pins = await pinnedIn(sam, closedConv);
check('several messages can be pinned at once', pins.length === 2);
await rpc(sam, `select public.set_message_pinned($1, false)`, [pinB]);
pins = await pinnedIn(sam, closedConv);
check('unpinning one message keeps the others', pins.length === 1 && pins[0].id === pinA);
const openMsg = await rpc(maya, `select id from public.messages where conversation_id = $1 limit 1`, [convId]).then((r) => r.id);
await expectError('only Closed Blinkers can pin messages', () => rpc(maya, `select public.set_message_pinned($1, true)`, [openMsg]));
await expectError("outsiders cannot pin messages in someone else's chat", () => rpc(maya, `select public.set_message_pinned($1, true)`, [pinA]));
await expectError('messages cannot be pinned directly', () =>
  as(jordan, async () => {
    const r = await db.query(`update public.messages set pinned_at = now() where id = $1 returning id`, [pinA]);
    if (r.rows.length === 0) throw new Error('no rows updated');
  })
);

// --- Photos: 5 MB buckets, own folders, chat photos only between Closed Blinkers, cleanup -------
// jordan and sam are Closed Blinkers (closedConv); maya and jordan are not (convId).
const buckets = (await db.query(`select id, public, file_size_limit from storage.buckets order by id`)).rows;
check('photo buckets exist with a 5 MB limit (chat photos private)',
  buckets.length === 3 && buckets.every((b) => Number(b.file_size_limit) === 5 * 1024 * 1024) &&
    buckets.find((b) => b.id === 'message-images')?.public === false,
  JSON.stringify(buckets));

const upload = (userId, bucket, name) =>
  as(userId, () => db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]));
await upload(maya, 'avatars', `${maya}/a.jpg`);
check('you can upload your own avatar photo', true);
await expectError("you can't upload into someone else's avatar folder", () => upload(maya, 'avatars', `${jordan}/a.jpg`));

const photoUrl = (userId) => `https://proj.supabase.co/storage/v1/object/public/avatars/${userId}/a.jpg`;
await as(maya, () => db.query(`update public.profiles set avatar = $1 where id = $2`, [photoUrl(maya), maya]));
check('an uploaded photo can be your avatar', (await db.query(`select avatar from public.profiles where id = $1`, [maya])).rows[0].avatar === photoUrl(maya));
await expectError("someone else's photo can't be your avatar", () =>
  as(maya, () => db.query(`update public.profiles set avatar = $1 where id = $2`, [photoUrl(jordan), maya]))
);

await upload(maya, 'blink-images', `${maya}/b.jpg`);
const photoBlink = await rpc(maya, `insert into public.blinks (author_id, text, image_path) values ($1, '', $2) returning id`, [maya, `${maya}/b.jpg`]).then((r) => r.id);
check('a Blink can be just a photo', !!photoBlink);
const feedPhoto = await rpc(jordan, `select image_path from public.blink_feed where id = $1`, [photoBlink]);
check('the feed includes the photo', feedPhoto?.image_path === `${maya}/b.jpg`);
await expectError("a Blink can't use a photo from someone else's folder", () =>
  as(maya, () => db.query(`insert into public.blinks (author_id, text, image_path) values ($1, 'x', $2)`, [maya, `${jordan}/b.jpg`]))
);

await upload(jordan, 'message-images', `${closedConv}/m.jpg`);
check('Closed Blinkers can upload chat photos', true);
await expectError('chat photos cannot be uploaded outside Closed Blinkers', () => upload(maya, 'message-images', `${convId}/m.jpg`));
const photoMsg = await rpc(jordan, `insert into public.messages (conversation_id, sender_id, text, image_path) values ($1, $2, '', $3) returning id`, [closedConv, jordan, `${closedConv}/m.jpg`]).then((r) => r.id);
check('Closed Blinkers can send a photo on its own', !!photoMsg);
await expectError('photos cannot be sent in chats outside Closed Blinkers', () =>
  as(maya, () => db.query(`insert into public.messages (conversation_id, sender_id, text, image_path) values ($1, $2, 'hi', $3)`, [convId, maya, `${convId}/m.jpg`]))
);
const samSeesPhoto = await as(sam, async () => (await db.query(`select count(*)::int as n from storage.objects where bucket_id = 'message-images'`)).rows[0].n);
const mayaSeesPhoto = await as(maya, async () => (await db.query(`select count(*)::int as n from storage.objects where bucket_id = 'message-images'`)).rows[0].n);
check('only the two people in the chat can see its photos', samSeesPhoto === 1 && mayaSeesPhoto === 0);
const preview = await rpc(sam, `select last_message_text from public.conversation_list where id = $1`, [closedConv]);
check('a photo-only message shows as "📷 Photo" in the inbox', preview?.last_message_text === '📷 Photo', preview?.last_message_text);

// No Vault secrets here, so deletions wait in the queue for the retry job.
await as(maya, () => db.query(`delete from public.blinks where id = $1`, [photoBlink]));
await as(maya, () => db.query(`update public.profiles set avatar = 'paw' where id = $1`, [maya]));
const queued = (await db.query(`select bucket, path from public.storage_cleanup order by id`)).rows;
check('deleting a Blink or replacing an avatar queues its photo for deletion',
  queued.some((q) => q.bucket === 'blink-images' && q.path === `${maya}/b.jpg`) &&
    queued.some((q) => q.bucket === 'avatars' && q.path === `${maya}/a.jpg`),
  JSON.stringify(queued));
const expiring = await rpc(maya, `insert into public.blinks (author_id, text, image_path) values ($1, 'bye', $2) returning id`, [maya, `${maya}/c.jpg`]).then((r) => r.id);
await db.query(`update public.blinks set expires_at = now() - interval '1 minute' where id = $1`, [expiring]);
await db.query(`select public.purge_expired_blinks()`);
check('expired Blinks have their photo deleted too',
  (await db.query(`select count(*)::int as n from public.storage_cleanup where path = $1`, [`${maya}/c.jpg`])).rows[0].n === 1);
await expectError('the app cannot run the storage cleanup', () => as(maya, () => db.query(`select public.process_storage_cleanup()`)));
const queueVisible = await as(maya, async () => (await db.query(`select count(*)::int as n from public.storage_cleanup`)).rows[0].n);
check('the cleanup queue is not readable from the app', queueVisible === 0);

// --- Username availability --------------------------------------------------------------
await db.exec(`set role anon`);
const taken = (await db.query(`select public.username_available('MayaChen') as ok`)).rows[0].ok;
const free = (await db.query(`select public.username_available('brand_new') as ok`)).rows[0].ok;
await db.exec(`reset role`);
check('username_available works before sign-in', taken === false && free === true);

// --- Realtime publication ------------------------------------------------------------------
const pub = (await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)).rows.map((r) => r.tablename);
check('calls, messages and notifications are published for realtime', JSON.stringify(pub) === JSON.stringify(['calls', 'messages', 'notifications']), JSON.stringify(pub));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
