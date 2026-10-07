import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

(async () => {
    const { supabase } = await import('./src/utils/supabase');
    for (const t of ['content_journeys', 'content_packages']) {
        const { error } = await supabase.from(t).select('published_at', { head: true, count: 'exact' });
        console.log(`content_ ${t}.published_at`, error ? `MISSING (${error.message})` : 'exists');
    }
    process.exit(0);
})();
