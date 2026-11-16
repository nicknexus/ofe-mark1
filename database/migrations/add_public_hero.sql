-- How the public organization page leads.
-- classic: logo, name, description, globe (posts replace the globe when they exist)
-- image: hero_image_url is the background
-- video: hero_video_url (YouTube or Vimeo) is the background
-- The context featured video is separate and is not used here.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS public_hero TEXT NOT NULL DEFAULT 'classic',
    ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
    ADD COLUMN IF NOT EXISTS hero_video_url TEXT;

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_public_hero_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_public_hero_check
    CHECK (public_hero IN ('classic', 'image', 'video'));

COMMENT ON COLUMN organizations.public_hero IS 'Public page hero: classic, image, or video. Image and video only render when their asset is set.';
COMMENT ON COLUMN organizations.hero_image_url IS 'Hero background uploaded on the Public page tab. Not pulled from evidence.';
COMMENT ON COLUMN organizations.hero_video_url IS 'Hero background video (YouTube or Vimeo) set on the Public page tab. Not the context featured video.';
