-- Migration: Add organization profile fields
-- Date: 2026-02-03
-- Description: Adds statement, website_url, and donation_url fields to organizations table

-- Add statement column (max 150 characters for a brief mission statement)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS statement VARCHAR(150);

-- Add website URL column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add donation URL column  
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS donation_url TEXT;

-- Comments
COMMENT ON COLUMN organizations.statement IS 'Brief mission statement or tagline (max 150 characters)';
COMMENT ON COLUMN organizations.website_url IS 'Organization website URL';
COMMENT ON COLUMN organizations.donation_url IS 'URL where people can donate to the organization';
