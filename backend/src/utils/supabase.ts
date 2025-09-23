import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env from project root (one level up from backend)
// In serverless environments, this will be a no-op as env vars are injected directly
dotenv.config({ path: process.env.NODE_ENV === 'production' ? undefined : '../.env' });

console.log('Environment check:', {
    SUPABASE_URL: process.env.SUPABASE_URL ? '✅ SET' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING'
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables. Check your .env file in project root.');
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Client for frontend requests (with anon key)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
    throw new Error('Missing Supabase anon key');
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey); 