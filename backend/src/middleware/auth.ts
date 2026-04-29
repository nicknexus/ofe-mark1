import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../utils/supabase';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

// Short-lived in-memory cache of verified tokens.
//
// Why: every authenticated request currently performs a network round-trip to
// Supabase Auth via supabase.auth.getUser(token). On a typical page nav the
// frontend may fire 10-25 authenticated requests in parallel, which amplifies
// auth latency. We cache the verification result by token-hash for 30s so
// bursts of requests for the same user resolve instantly.
//
// Security:
// - Cache key is sha256(token) — we never log or persist raw tokens.
// - TTL is short (30s). Sign-out / token rotation flushes within the TTL.
// - Cache misses still hit Supabase, so revoked tokens fail correctly within
//   one TTL window at worst — same window Supabase clients use for refresh.
// - In-memory only; nothing crosses processes/restarts.
const TOKEN_CACHE_TTL_MS = 30_000;
const TOKEN_CACHE_MAX_ENTRIES = 5_000;

type CacheEntry = { user: { id: string; email: string }; expiresAt: number };

const tokenCache = new Map<string, CacheEntry>();

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function pruneCache(now: number) {
    if (tokenCache.size < TOKEN_CACHE_MAX_ENTRIES) return;
    // Drop expired first, then oldest entries until size is reasonable.
    for (const [key, entry] of tokenCache) {
        if (entry.expiresAt <= now) tokenCache.delete(key);
        if (tokenCache.size < TOKEN_CACHE_MAX_ENTRIES * 0.8) return;
    }
    // Still too many — evict oldest by insertion order (Map iterates insertion order)
    while (tokenCache.size >= TOKEN_CACHE_MAX_ENTRIES * 0.8) {
        const firstKey = tokenCache.keys().next().value;
        if (!firstKey) break;
        tokenCache.delete(firstKey);
    }
}

const VERBOSE_AUTH_LOG = process.env.VERBOSE_AUTH_LOG === '1';

export const authenticateUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid authorization header' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const now = Date.now();
        const key = hashToken(token);

        // Cache hit?
        const cached = tokenCache.get(key);
        if (cached && cached.expiresAt > now) {
            req.user = cached.user;
            if (VERBOSE_AUTH_LOG) {
                console.log(`[Auth] cache hit ${cached.user.email}`);
            }
            return next();
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            // Negative result: don't cache, just reject.
            tokenCache.delete(key);
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        const resolved = {
            id: user.id,
            email: user.email || '',
        };
        req.user = resolved;

        tokenCache.set(key, { user: resolved, expiresAt: now + TOKEN_CACHE_TTL_MS });
        pruneCache(now);

        if (VERBOSE_AUTH_LOG) {
            console.log(`[Auth] verified ${resolved.email} (cached for ${TOKEN_CACHE_TTL_MS / 1000}s)`);
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Optional helper for endpoints that mutate auth state (logout, password
 * change, etc) so they can flush the cache for a specific token.
 */
export function invalidateTokenCache(token: string) {
    tokenCache.delete(hashToken(token));
}
