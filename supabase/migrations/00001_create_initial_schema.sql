-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user role enum
CREATE TYPE user_role AS ENUM ('admin', 'sales', 'seo', 'client');

-- Create lead source enum
CREATE TYPE lead_source AS ENUM ('facebook', 'linkedin', 'form', 'seo');

-- Create lead status enum
CREATE TYPE lead_status AS ENUM ('pending', 'completed', 'remainder');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  role user_role NOT NULL DEFAULT 'sales',
  is_client_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source lead_source NOT NULL,
  status lead_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create SEO meta tags table
CREATE TABLE seo_meta_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_identifier TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  keywords TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role permissions table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role NOT NULL,
  feature TEXT NOT NULL,
  can_read BOOLEAN DEFAULT false,
  can_write BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, feature)
);

-- Create indexes
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_notes_lead_id ON notes(lead_id);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_meta_tags_updated_at BEFORE UPDATE ON seo_meta_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  username_value TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- Extract username from email (remove @miaoda.com)
  username_value := REPLACE(NEW.email, '@miaoda.com', '');
  
  -- Insert profile with role based on user count
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    username_value,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::user_role ELSE 'sales'::user_role END
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Insert default role permissions
INSERT INTO role_permissions (role, feature, can_read, can_write) VALUES
  -- Admin permissions (full access)
  ('admin', 'leads', true, true),
  ('admin', 'seo_meta_tags', true, true),
  ('admin', 'users', true, true),
  ('admin', 'permissions', true, true),
  ('admin', 'activity_logs', true, false),
  ('admin', 'notes', true, true),
  ('admin', 'messages', true, true),
  
  -- Sales permissions (default)
  ('sales', 'leads', true, true),
  ('sales', 'notes', true, true),
  ('sales', 'messages', true, true),
  ('sales', 'activity_logs', true, false),
  
  -- SEO permissions (default)
  ('seo', 'leads', true, true),
  ('seo', 'seo_meta_tags', true, true),
  ('seo', 'notes', true, true),
  ('seo', 'messages', true, true),
  ('seo', 'activity_logs', true, false),
  
  -- Client permissions (default - read only)
  ('client', 'leads', true, false),
  ('client', 'activity_logs', true, false);

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- Helper function to check permissions
CREATE OR REPLACE FUNCTION has_permission(uid UUID, feature_name TEXT, permission_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON p.role = rp.role
    WHERE p.id = uid 
      AND rp.feature = feature_name
      AND (
        (permission_type = 'read' AND rp.can_read = true) OR
        (permission_type = 'write' AND rp.can_write = true)
      )
  );
$$;

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile except role" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- Create public view for profiles
CREATE VIEW public_profiles AS
  SELECT id, username, role, created_at FROM profiles;

-- RLS Policies for leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to leads" ON leads
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view leads with read permission" ON leads
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'leads', 'read'));

CREATE POLICY "Users can insert leads with write permission" ON leads
  FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'leads', 'write'));

CREATE POLICY "Users can update leads with write permission" ON leads
  FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'leads', 'write'));

CREATE POLICY "Users can delete leads with write permission" ON leads
  FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'leads', 'write'));

-- RLS Policies for seo_meta_tags
ALTER TABLE seo_meta_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to seo_meta_tags" ON seo_meta_tags
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view seo_meta_tags with read permission" ON seo_meta_tags
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'seo_meta_tags', 'read'));

CREATE POLICY "Users can insert seo_meta_tags with write permission" ON seo_meta_tags
  FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'seo_meta_tags', 'write'));

CREATE POLICY "Users can update seo_meta_tags with write permission" ON seo_meta_tags
  FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'seo_meta_tags', 'write'));

CREATE POLICY "Users can delete seo_meta_tags with write permission" ON seo_meta_tags
  FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'seo_meta_tags', 'write'));

-- RLS Policies for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to notes" ON notes
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view notes with read permission" ON notes
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'notes', 'read'));

CREATE POLICY "Users can insert notes with write permission" ON notes
  FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'notes', 'write'));

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to messages" ON messages
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view messages with read permission" ON messages
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'messages', 'read'));

CREATE POLICY "Users can insert messages with write permission" ON messages
  FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'messages', 'write'));

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to activity_logs" ON activity_logs
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view activity_logs with read permission" ON activity_logs
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'activity_logs', 'read'));

CREATE POLICY "Users can insert their own activity_logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to role_permissions" ON role_permissions
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their role permissions" ON role_permissions
  FOR SELECT TO authenticated USING (
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );