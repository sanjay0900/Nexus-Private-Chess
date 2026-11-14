# Nexus Chess

A two-player private chess app with a polished UI.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

### Test two players on one PC

1. Browser A: Create Room.
2. Copy the six-character room code.
3. Browser B: open http://localhost:3000 and Join Room with that code.
4. Browser A is White, Browser B is Black.
5. Moves sync through the local Next.js API.

### Supabase

For two physical devices, create a Supabase project and run `supabase.sql` in its SQL editor. Then create `.env.local` from `.env.example` with your project URL and anon key. Restart the dev server.

When Supabase credentials are present, the client uses Supabase Realtime. Without credentials, local development uses the Next.js `/api/games` route so two browser windows on the same computer can still play.
