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
