# Hotel RJ: project memory

Last updated: 2026-11-06

## What this repo is
Hotel website + digital QR menu + Counter/Waiter POS.
- Website/menu: React 18 + TS + Vite + Tailwind (Vercel / GitHub Pages)
- Counter POS (Windows): Electron (`electron/*.cjs`), local DB, Wi-Fi sync server on port 5050
- Waiter app (Android): Capacitor (`android/`)
- Cloud: Supabase REST (no SDK), project `kupbuusakxvsfprwdpbr`

Commands: `npm run dev | typecheck | lint | test | build | electron:build`.
Run `npm install` first (new devDependencies: vitest, eslint, typescript-eslint).

## What was done (security and tooling pass)
- `src/config.ts`: Supabase URL/key from `VITE_*` env (falls back to bundled project), storage keys.
- Device pairing (`src/utils/deviceAuth.ts`, `PairDeviceModal`, `PairedDevicesPanel`): staff never log in.
  The owner pairs each device once with the shared pairing code (password of one Supabase user).
  Emailed OTP also exists behind a "Use emailed OTP instead" link (needs custom SMTP). Unpaired devices fall back to the anon key.
- Manager PIN (`src/utils/pin.ts`): PBKDF2 hash, shared via `app_settings`, lockout after 5 failures.
  Legacy `1234`/`8888` only work while no PIN has been set. One PIN replaces Manager/Cashier PINs.
- Counter PC sync server: needs `X-Sync-Token` (8-char Waiter Pairing Code shown on the Counter POS). Loopback without a web Origin is exempt.
- Electron: sandbox on, navigation locked. Android: `allowBackup=false` (cleartext stays on for the LAN HTTP sync server).
- Safe refactors: `tableMerge.ts`, `dates.ts`, `storage.ts`, lazy-loaded WaiterPOS/DigitalMenuPage, exact route matching, local-date fixes, hook-order fixes.
- Tooling: ESLint (`any` = warning), Vitest (19 tests), `.github/workflows/ci.yml`, README rewrite, `docs/SECURITY_SETUP.md`.

## NOT yet done: Supabase is still open
No SQL has been run. The database still allows anon read/write. Until the steps below are finished the app behaves as before.

## Next steps (in order)
1. **Install and verify locally:** `npm install`, then `npm run typecheck && npm test && npm run build`.
2. **Commit and push** (do it from your own terminal; check `.env` is not staged). `deploy.yml`, `vercel.json` etc. had uncommitted changes before this work.
3. **Deploy the website only** and check: home page, test booking, `?view=menu` (images), `?mode=pos`, dish sold-out toggle (PIN 1234/8888 until a new PIN is set).
4. **Supabase auth setup**
   - Authentication > Users > Add user > Create new user: email `pairing@hotelrj.co.in` (any), long password = the pairing code, tick Auto Confirm.
   - Authentication > Sign In / Providers: turn OFF "Allow new users to sign up" (after creating the user).
5. **Run `supabase/migrations/20261106a_device_pairing_tables.sql`** in the SQL Editor (additive, safe).
6. **Build and install the Windows Counter PC app** (`npm run electron:build`) at a quiet time. Keep the old installer for rollback.
7. **Build and install the new APK on every waiter phone** (`npm run build && npx cap sync android`, then Android Studio or the `build-apk.yml` workflow).
   Old phones get 401 from the new Counter PC until they have the new APK and the Waiter Pairing Code. Update Counter PC and phones together.
8. **Pair devices:** Counter PC first (Owner Insights PIN screen > "Owner: pair this device / set PIN"), set the manager PIN, then each phone and the owner's browser.
   On each phone enter the Waiter Pairing Code (Counter POS Sync panel) in Sync Counter. Check Owner Insights > Cloud > Paired devices.
9. **Test on a paired phone:** settle a bill, void with PIN, toggle a dish, open Owner Insights, print a receipt, sync with the Counter PC.
10. **Run `supabase/migrations/20261106b_lockdown_rls.sql` last.** Rollback is at the bottom of that file. After it, anon can only read `menu_items`.

## Later / optional
- Emailed OTP: set custom SMTP (Authentication > Emails > SMTP Settings, e.g. Gmail app password) and edit the Magic link template to show `{{ .Token }}`.
- SMS OTP via MSG91: `supabase/functions/send-sms-msg91` (needs DLT approval; not wired into the UI).
- Image optimisation (about 200 JPEGs to WebP with path updates).
- CSP for the web and Electron builds (test on the installed Electron app first).
- Split large components (`WaiterPOS` 3.9k lines, `OwnerInsights`, `DigitalMenuPage`, `HotelOperationsModal`); reduce the ~155 `any` warnings.
- Analytics "today" boundary uses UTC (`analyticsApi.ts`); fixing it changes report numbers, so confirm first.
- Rotate the pairing code with SQL (see `docs/SECURITY_SETUP.md`) if it leaks; use Revoke for a lost phone.

## Caveats
- Pairing, the PIN flow, Electron and the Android app have not been tested against live Supabase or on real devices; only typecheck, lint, unit tests and the web build were run.
- `.git` in the mounted folder may block lock-file cleanup; commit from a normal terminal.
- `supabase/migrations/20261106_lockdown_rls_device_pairing.sql` is a superseded stub (do not run); delete it when convenient.
