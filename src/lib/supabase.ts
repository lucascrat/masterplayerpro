/**
 * Supabase client configuration
 * Default schema: masterplayer
 * Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in the environment.
 */
// Deployment Trigger: Build Output Directory updated to 'dist'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
