import { createClient } from '@supabase/supabase-js';

// Public anon key only — this file is bundled into the browser, so it must
// never hold a service-role key or any other server-side secret. Row Level
// Security policies (see supabase/migrations) are what actually constrain
// what this client can do.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails fast with a clear message instead of letting every query error
  // out individually with an opaque "Failed to fetch".
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and set ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * A second, throwaway Supabase client against the same project — used only
 * to verify a password without disturbing the main `supabase` client's
 * active session (see authService.js's changePassword()). Signing in
 * normally (`supabase.auth.signInWithPassword`) REPLACES the caller's
 * current session with a fresh one, and a fresh password-only sign-in is
 * only ever aal1 — doing that on the main client would silently downgrade
 * an already-aal2 admin session back to aal1 just to check a password,
 * which this project's AAL2 model must never do. This client never
 * persists a session to storage, never auto-refreshes, and never scans the
 * URL for auth callback params — it exists purely to ask "is this password
 * correct for this email," and the caller discards it immediately after.
 */
export function createReauthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
