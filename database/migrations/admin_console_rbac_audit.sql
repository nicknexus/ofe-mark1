-- Admin console: roles, support-agent assignments, and audit log.
-- Run once. Promotes existing platform admins to 'super' BEFORE any support
-- agents are created (new agents default to 'support').

-- 1) Roles on platform_admins (super = full access; support = scoped sub-account).
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS role text;
UPDATE platform_admins SET role = 'super' WHERE role IS NULL;
ALTER TABLE platform_admins ALTER COLUMN role SET DEFAULT 'support';
ALTER TABLE platform_admins ALTER COLUMN role SET NOT NULL;
ALTER TABLE platform_admins ADD CONSTRAINT platform_admins_role_check CHECK (role IN ('super', 'support'));

-- 2) Which orgs a support agent may handle (many-to-many; FK cleans up on delete).
CREATE TABLE IF NOT EXISTS support_org_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, organization_id)
);
ALTER TABLE support_org_assignments ENABLE ROW LEVEL SECURITY;

-- 3) Audit log of admin/support actions.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  admin_email text,
  organization_id uuid,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
