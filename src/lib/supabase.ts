/**
 * Supabase client configuration
 * Default schema: masterplayer
 * Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in the environment.
 */
// Deployment Trigger: Build Output Directory updated to 'dist'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyagfghcnzenvbhbtsvd.supabase.co';
const supabaseAnonKey = 'sb_publishable_vdg0_67y7KngtEi0Rjqy1Q_i83l9mWe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
