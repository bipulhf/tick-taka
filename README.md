# Tick & Taka

A private, single-user Android app that runs my days and my money from one screen.
"Tick" is time, "Taka" is money. The full product and technical spec is in
`tick_taka_spec.pdf`; the build order is in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

```
tick-taka/
  apps/api/        Bun + Hono + Drizzle + SQLite (one process, pm2, croner jobs)
  apps/mobile/     Expo + Expo Router app, Android only (NativeWind, TanStack Query)
    modules/sms-reader/   local Expo module in Kotlin for SMS capture
  packages/shared/ Zod schemas and pure domain logic used by both
  deploy/          Nginx site config
```

The mobile app imports only the `AppType` type from `apps/api` (Hono RPC client) plus
pure logic from `packages/shared`.

## Requirements

- Bun 1.3+ (package manager for every workspace)
- Node.js 24 (Expo's tooling still needs it)
- For local Android builds: Android SDK + JDK 17. EAS Build needs neither.

## Develop

```bash
bun install                      # all workspaces
bun run check                    # Biome, TypeScript and every test suite
```

### API

```bash
cd apps/api
cp .env.example .env
bun run hash-password -- "your password"     # paste into APP_PASSWORD_HASH
bun -e 'console.log(crypto.randomUUID() + crypto.randomUUID())'   # JWT_SECRET
bun run dev                                   # http://localhost:3000/health
```

Migrations run automatically on start. After changing `src/db/schema/*`, run
`bun run db:generate` and commit the new file in `drizzle/`. The first start seeds areas,
categories (with budget buckets) and the Morning and Shutdown routines.

Set `OPENAI_API_KEY` to enable AI features. Model names (`OPENAI_MODEL_FAST`,
`OPENAI_MODEL_SMART`) and per-million-token prices for the monthly cost cap are
environment variables, so models change without a code change.

### Mobile

SMS capture uses a custom native module, so the app runs in a development build
(`expo-dev-client`), not Expo Go.

```bash
cd apps/mobile
cp .env.example .env              # EXPO_PUBLIC_API_URL=http://<your LAN IP>:3000
bunx eas-cli build -p android --profile development   # install the APK it prints
bun run start                     # expo start --dev-client
```

Or build locally with `bunx expo run:android` (needs the Android SDK).

## Deploy the API (VPS, pm2, Nginx)

Exactly one pm2 instance in fork mode: SQLite wants a single writer and the scheduled
jobs must run once.

```bash
git clone <repo> ~/tick-taka && cd ~/tick-taka && bun install
mkdir -p ~/tick-taka-data/backups ~/tick-taka-data/uploads
nano apps/api/.env                # HOST=127.0.0.1, PORT, DB_PATH=~/tick-taka-data/app.db, secrets
chmod 600 apps/api/.env
cd apps/api && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
pm2 install pm2-logrotate
sudo cp ~/tick-taka/deploy/nginx-tick-taka.conf /etc/nginx/sites-available/tick-taka
sudo ln -s /etc/nginx/sites-available/tick-taka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tt-api.bipulhf.dev
```

Updating: `git pull && bun install && pm2 restart tick-taka-api`.

### Backups

Every night at 3 am (Asia/Dhaka) the API writes `VACUUM INTO` copies to the backups
folder and keeps the newest 14. Once a month, restore one locally to make sure it works:

```bash
sqlite3 ~/tick-taka-data/backups/app-2026-10-04.db "pragma integrity_check; select count(*) from transactions;"
```

Settings › Export downloads a full JSON export to the phone.

## Install the app

```bash
cd apps/mobile
bunx eas-cli build -p android --profile preview    # APK pointing at the HTTPS API
```

The app is a sideloaded APK (Google Play only allows SMS permissions for default SMS
apps). If the SMS permission is greyed out, open phone Settings › Apps › Tick & Taka,
tap ⋮, choose *Allow restricted settings*, then grant SMS again.

## Notes on decisions

- **Bun everywhere**, as the spec asks; Bun's linker is set to `hoisted` (`bunfig.toml`)
  because Metro expects a flat `node_modules`.
- **Money** is integer minor units everywhere; **instants** are UTC epoch ms; habit dates
  and budget months are local strings in the user's time zone.
- **Offline**: reads come from a persisted TanStack Query cache; every write goes
  through one scoped mutation key, so queued writes replay in order after a restart.
  IDs are ULIDs made on the phone; PATCHes carry the edit time and lose to newer rows.
- **Weekdays** in plain-words recurrence ("every weekday") follow the Bangladesh work
  week, Sunday to Thursday; the default week starts on Saturday. Both are settings.
- A few columns beyond the spec's table list: `tasks.urgent` and `tasks.sort`
  (Eisenhower and ordering), `tasks.goal_id` (goals become tasks), `time_entries.note`,
  `habits.remind_at`, `recurring.currency/active/overdue_at`, `goals.create_tasks`,
  `debts.remind_at`, and `sort` columns on lists.
