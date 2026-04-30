-- Add featured_video_url to organization_context.
-- Optional URL to a YouTube or Vimeo video shown at the top of an org's public
-- /context page. Stored as raw URL; the app extracts the platform/id at render
-- time so changes to embed format are a code-only change.

ALTER TABLE organization_context
ADD COLUMN IF NOT EXISTS featured_video_url TEXT;
