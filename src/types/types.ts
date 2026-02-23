export type UserRole = 'super_admin' | 'admin' | 'lead_manager' | 'seo_manager' | 'sales_person' | 'seo_person' | 'client';
export type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo' | (string & {});
export type LeadStatus = 'pending' | 'completed' | 'remainder';

export type FeatureName =
  | 'leads'
  | 'users'
  | 'activity_logs'
  | 'subscriptions'
  | 'seo_meta_tags'
  | 'blogs'
  | 'sites'
  | 'ip_security'
  | 'permissions';

export type Permission = {
  can_read: boolean;
  can_write: boolean;
};

export type PermissionMatrix = Record<string, Record<string, Permission>>;

export type UserSiteAssignment = {
  id: string;
  wp_user_id: string;
  site_id: string;
  app_role: UserRole;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type SeoMetaTag = {
  id: string;
  page_identifier: string;
  title: string;
  keywords: string | null;
  description: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Message = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role: UserRole;
  feature: FeatureName;
  can_read: boolean;
  can_write: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

export type NoteWithUser = Note & {
  user?: Profile;
};

export type MessageWithUser = Message & {
  user?: Profile;
};
