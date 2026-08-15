-- Per-file cap on the evidence-files bucket. Standard uploads handle up to
-- 5 GB; resumable (TUS) can go higher, but 5 GB is plenty for field video /
-- scanned reports. The global Storage Settings limit still wins if it's lower
-- — raise that in the dashboard if uploads over ~50 MB keep failing.
UPDATE storage.buckets
SET file_size_limit = 5368709120 -- 5 GB
WHERE id = 'evidence-files';
