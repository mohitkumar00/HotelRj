/**
 * Central runtime configuration.
 * Values come from Vite env vars (.env) and fall back to the previously
 * bundled project so existing builds keep working without a .env file.
 */
const FALLBACK_SUPABASE_URL = 'https://kupbuusakxvsfprwdpbr.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_lZf74V3b-jAG3sIYxSDeVA_cFIdt74o';

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

/** Default port of the Counter PC Wi-Fi sync server. */
export const SYNC_SERVER_PORT = 5050;

/** localStorage keys (single source of truth). */
export const STORAGE_KEYS = {
  syncUrl: 'hotel_rj_counter_sync_url',
  /** Older key still read as a fallback. */
  legacySyncUrl: 'hotel_rj_sync_server_url',
  syncToken: 'hotel_rj_sync_token',
  session: 'hotel_rj_cloud_session',
  pinHash: 'hotel_rj_pin_v2',
  pinLock: 'hotel_rj_pin_lock',
  ownerPhone: 'hotel_rj_owner_phone', // WhatsApp share target in Owner Insights (not auth)
  ownerEmail: 'hotel_rj_owner_email',
} as const;
