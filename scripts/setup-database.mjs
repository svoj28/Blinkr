// Creates Blinkr's tables, security rules and functions in your Supabase database.
//
//   npm run db:setup
//
// Reads SUPABASE_DB_URL from .env and runs supabase/blinkr-schema.sql. Safe to run again.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL?.trim();

if (!url) {
  console.error(`
✗ SUPABASE_DB_URL is empty.

  1. Open your project on supabase.com and click "Connect".
  2. Copy the "Session pooler" connection string.
  3. Paste it into .env as SUPABASE_DB_URL=... and replace [YOUR-PASSWORD] with your database password.

  Or skip this script: open Supabase > SQL Editor, paste supabase/blinkr-schema.sql and click Run.
`);
  process.exit(1);
}

const schemaPath = fileURLToPath(new URL('../supabase/blinkr-schema.sql', import.meta.url));
const schema = readFileSync(schemaPath, 'utf8');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  console.log('Connecting to Supabase…');
  await client.connect();

  console.log('Creating Blinkr tables, security rules and functions…');
  await client.query(schema);

  const { rows } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_name in ('profiles', 'blinks', 'likes', 'comments', 'follows', 'conversations', 'messages', 'notifications', 'push_tokens')
  `);
  if (rows.length !== 9) {
    throw new Error(`Expected 9 Blinkr tables, found ${rows.length}.`);
  }

  console.log('✓ Blinkr database is ready. Start the app with: npx expo start -c');
} catch (error) {
  console.error(`\n✗ Database setup failed: ${error.message}`);
  if (/ENOTFOUND|ENETUNREACH|EHOSTUNREACH/.test(error.message)) {
    console.error('  Tip: use the "Session pooler" connection string (the direct one needs IPv6).');
  }
  if (/password authentication failed/.test(error.message)) {
    console.error('  Tip: check the database password in SUPABASE_DB_URL (Project Settings > Database to reset it).');
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
