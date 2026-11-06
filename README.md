# Hotel RJ

Public hotel website, digital QR menu and a Counter/Waiter POS, shipped as:

| Target | How |
|---|---|
| Website + QR menu | Vite build, hosted on Vercel / GitHub Pages |
| Counter POS (Windows) | Electron (`electron/`), local DB + Wi-Fi sync server on port 5050 |
| Waiter app (Android) | Capacitor (`android/`) |
| Cloud | Supabase (bills, audit logs, expenses, menu, rooms, tables) |

## Stack
React 18, TypeScript, Vite, Tailwind, Electron 45, Capacitor 8, Supabase REST (no SDK).

## Getting started
```bash
npm install
cp .env.example .env     # optional: falls back to the bundled project if missing
npm run dev              # website; add ?mode=pos for the POS, ?view=menu for the digital menu
```

## Scripts
| Command | Purpose |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (`any` is a warning, hooks rules are errors) |
| `npm test` | Vitest unit tests (PIN, dates, table merge, pricing) |
| `npm run build` | Typecheck + production build |
| `npm run electron:build` | Windows installer + portable build in `dist-electron/` |

Android: `npm run build && npx cap sync android`, then build in Android Studio (CI: `.github/workflows/build-apk.yml`).

## Project layout
```
src/components    UI sections, POS (WaiterPOS), Owner Insights, pairing modals
src/pages         Digital menu
src/utils         API clients, deviceAuth (pairing), pin, storage, dates, tableMerge
src/config.ts     Supabase URL/key (VITE_* env) + storage keys
electron/         Main process, local DB, sync server (pairing code), cloud sync
supabase/         SQL migrations + optional MSG91 SMS hook
docs/             SECURITY_SETUP.md, proposal and invoice
```

## Security model (summary)
- Staff do not log in. The owner pairs each device once with an owner-defined pairing code (Supabase Auth; emailed OTP optional).
- Manager PIN is hashed (PBKDF2), shared across paired devices, with lockout.
- After the lockdown migration the public key can only read `menu_items`.
- Waiter phones need the Counter PC's pairing code for the local Wi-Fi API.

Full rollout steps: [docs/SECURITY_SETUP.md](docs/SECURITY_SETUP.md).
