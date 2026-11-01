# Blinkr

A mobile-first social app built with React Native, Expo (SDK 57), Expo Router, TypeScript and Supabase.
Posts are called **Blinks**. Blinks are text only: no photos or videos. The only visuals are emojis
(typed in the text) and an optional sticker from the built-in set in `src/constants/stickers.ts`.

**Features:** email accounts, a live feed, posting Blinks with stickers, likes, comments, follows,
other people's profiles, search, one-to-one chat with live updates, an activity screen, and push notifications.

---

## 1. Connect Supabase (once)

Everything the app needs goes in **`.env`** (already created, git-ignored). Until the Supabase keys are there,
the app shows a setup screen instead of crashing.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project, click **Connect** and copy into `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL` → the Project URL
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → the publishable key (`sb_publishable_…`; the older "anon" key also works)
3. Create the database tables, security rules and functions. Pick one:
   - **Automatic:** in **Connect**, copy the **Session pooler** connection string into `SUPABASE_DB_URL`
     (replace `[YOUR-PASSWORD]` with your database password), then run:
     ```powershell
     npm run db:setup
     ```
   - **By hand:** open **SQL Editor**, paste all of `supabase/blinkr-schema.sql`, click **Run**.

   Running it again later is safe.
4. **Optional, for quicker testing:** Authentication → Sign In / Providers → Email → turn off **Confirm email**.
   With it on (the default), new people must click the link in their email before signing in.
5. **Forgot password:** the default "Reset password" email works as is; its link opens the app's
   new-password screen. Supabase only sends people back to addresses you allow, so in
   Authentication → URL Configuration → **Redirect URLs**, add:
   - `blinkr://**` (installed app / development build)
   - `exp://**` (Expo Go)
   - `http://localhost:8081/**` (web while developing; add your real web address too if you host it)

   Supabase's built-in email sender only allows a few emails an hour; for real use, set up your own SMTP
   (Authentication → Emails → SMTP Settings).
6. **Photos** (avatars, Blink photos, and chat photos between Closed Blinkers; 5 MB each): `db:setup` creates
   the storage buckets and their rules. When a Blink expires or is deleted, its photo is deleted too. The
   database does that through the Storage API, so give it your project URL and secret key once, in
   **SQL Editor** (the secret key is under Project Settings → API Keys; it stays inside the database's Vault):
   ```sql
   select vault.create_secret('https://your-project-ref.supabase.co', 'blinkr_project_url');
   select vault.create_secret('sb_secret_xxxxxxxxxxxxxxxx', 'blinkr_secret_key');
   select public.process_storage_cleanup(); -- deletes anything that was waiting
   ```
   Until then, photos to delete wait in the `storage_cleanup` table and are removed within the hour after.
7. Restart the dev server so it picks up the keys:
   ```powershell
   npx expo start -c
   ```

## 2. Try it on your phone

```powershell
npx expo start -c
```

Scan the QR code with **Expo Go** (Android: inside Expo Go; iPhone: Camera app). Phone and PC must be on the
same Wi-Fi; if it can't connect, use `npx expo start --tunnel`. Create two accounts (e.g. one on your phone,
one in the browser with `npm run web`) to test follows, likes, comments, chat and notifications between them.

## 3. Push notifications

Blinkr's database sends pushes through Expo's push service whenever someone likes, comments, follows or
messages you. The phone registers itself automatically after sign-in. It needs:

1. An Expo account and project ID: run `npx eas login`, then `npx eas init`. Paste the project ID it prints
   into `.env` as `EAS_PROJECT_ID`.
2. Where it works:
   - **iPhone + Expo Go:** works.
   - **Android + Expo Go:** not supported by Expo since SDK 53. Use an installed build (next section).
     Android builds also need Firebase credentials once: run `npx eas credentials`, choose Android →
     *Google Service Account Key for Push Notifications (FCM V1)* and follow the prompts.
   - **Web / simulators:** no push (the in-app Activity screen still works everywhere).

## 4. App store builds (EAS)

Builds run in Expo's cloud; `.easignore` makes sure your `.env` keys are included.

| Command                    | What you get                                                           |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run build:preview`    | An Android APK you can install directly on your phone (link + QR code) |
| `npm run build:dev`        | A development build (like Expo Go, but supports push on Android)       |
| `npm run build:production` | Store-ready builds for Google Play (AAB) and the App Store (IPA)       |
| `npm run submit`           | Uploads the production builds to the stores                           |

Before the first production build: set `APP_BUNDLE_ID` in `.env` (for example `com.yourname.blinkr`; it can't
change after release), replace the placeholder app icon and splash image in `assets/images/`, and have a
Google Play Console account and an Apple Developer account ready. EAS asks for the store credentials the first time.

## Scripts

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm start`         | Start the dev server (scan with Expo Go)                         |
| `npm run web`       | Open Blinkr in a desktop browser                                 |
| `npm run db:setup`  | Create/update the Supabase database from `supabase/blinkr-schema.sql` |
| `npm run test:db`   | Test the database schema and security rules (no Supabase needed) |
| `npm run typecheck` | Check TypeScript types                                           |

## Design: "editorial"

Formal but distinct from the usual social apps, borrowing from print publications:
a serif "Blinkr" masthead with an italic date line and a double rule; Newsreader (serif) for titles and opened
Blinks, Manrope (sans) for reading; ivory paper, white cards and one deep green accent; a slim colored edge on
every Blink in its author's color; and a floating dock with five labeled tabs. Tokens: `src/constants/theme.ts`.

## Project structure

```
supabase/blinkr-schema.sql   Tables, row-level security, triggers (notifications, push), realtime
scripts/                     db:setup and test:db
src/
  app/                       Screens (Expo Router: file = route)
    _layout.tsx              Providers, fonts, signed-in / signed-out routes
    sign-in.tsx, sign-up.tsx
    (tabs)/                  Feed, Search, Create, Messages, Profile (floating dock)
    blink/[id].tsx           A Blink with its comments
    user/[id].tsx            Someone else's profile (Follow, Message)
    chat/[id].tsx            One-to-one chat
    notifications.tsx        Activity: likes, comments, follows
  api/                       Supabase queries + TanStack Query hooks, realtime
  components/                Reusable UI
  lib/                       Supabase client, query cache, push notifications
  state/auth-context.tsx     Sign in / sign up / sign out
  constants/, hooks/, types/, utils/
```

## Security notes

- `EXPO_PUBLIC_` values are bundled into the app. That's expected for the Supabase URL and publishable key:
  row-level security in `supabase/blinkr-schema.sql` decides who can read and write what (`npm run test:db` checks it).
- `SUPABASE_DB_URL` contains your database password. It's only used by `npm run db:setup`, never shipped in the app,
  and `.env` is git-ignored. Never put the Supabase **secret** / service-role key in `.env`.
