-- Create subscription plan enum
CREATE TYPE subscription_plan_type AS ENUM ('monthly', 'quarterly', 'annual');

-- Create subscription plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan_type subscription_plan_type NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  features JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add subscription fields to profiles
ALTER TABLE profiles ADD COLUMN subscription_plan_id UUID REFERENCES subscription_plans(id);
ALTER TABLE profiles ADD COLUMN subscription_start_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN subscription_end_date TIMESTAMPTZ;

-- Create index
CREATE INDEX idx_profiles_subscription ON profiles(subscription_plan_id);

-- Add trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, plan_type, price, features) VALUES
  ('Monthly Plan', 'monthly', 49.99, '{"leads_limit": 100, "users_limit": 5, "seo_pages_limit": 20, "support": "Email", "analytics": true, "api_access": false}'),
  ('Quarterly Plan', 'quarterly', 129.99, '{"leads_limit": 350, "users_limit": 10, "seo_pages_limit": 50, "support": "Priority Email", "analytics": true, "api_access": true, "discount": "15% off"}'),
  ('Annual Plan', 'annual', 479.99, '{"leads_limit": 1500, "users_limit": 25, "seo_pages_limit": 200, "support": "24/7 Phone & Email", "analytics": true, "api_access": true, "custom_reports": true, "discount": "20% off"}');

-- RLS Policies for subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins have full access to subscription plans" ON subscription_plans
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Insert dummy leads
INSERT INTO leads (name, email, phone, source, status, assigned_to) VALUES
  ('Alice Johnson', 'alice.j@example.com', '+1-555-0101', 'facebook', 'pending', NULL),
  ('Bob Smith', 'bob.smith@example.com', '+1-555-0102', 'linkedin', 'completed', NULL),
  ('Carol White', 'carol.w@example.com', '+1-555-0103', 'form', 'pending', NULL),
  ('David Brown', 'david.b@example.com', '+1-555-0104', 'seo', 'remainder', NULL),
  ('Emma Davis', 'emma.d@example.com', '+1-555-0105', 'facebook', 'completed', NULL),
  ('Frank Miller', 'frank.m@example.com', '+1-555-0106', 'linkedin', 'pending', NULL),
  ('Grace Wilson', 'grace.w@example.com', '+1-555-0107', 'form', 'completed', NULL),
  ('Henry Taylor', 'henry.t@example.com', '+1-555-0108', 'seo', 'pending', NULL),
  ('Ivy Anderson', 'ivy.a@example.com', '+1-555-0109', 'facebook', 'remainder', NULL),
  ('Jack Thomas', 'jack.t@example.com', '+1-555-0110', 'linkedin', 'completed', NULL),
  ('Kate Martinez', 'kate.m@example.com', '+1-555-0111', 'form', 'pending', NULL),
  ('Leo Garcia', 'leo.g@example.com', '+1-555-0112', 'seo', 'completed', NULL),
  ('Mia Rodriguez', 'mia.r@example.com', '+1-555-0113', 'facebook', 'pending', NULL),
  ('Noah Lee', 'noah.l@example.com', '+1-555-0114', 'linkedin', 'remainder', NULL),
  ('Olivia Walker', 'olivia.w@example.com', '+1-555-0115', 'form', 'completed', NULL);

-- Insert dummy SEO meta tags
INSERT INTO seo_meta_tags (page_identifier, title, keywords, description) VALUES
  ('/home', 'Marketing Dashboard - Track Your Leads', 'marketing, dashboard, leads, analytics', 'Comprehensive marketing tracking dashboard for managing leads from multiple sources'),
  ('/about', 'About Us - Marketing Solutions', 'about, company, marketing solutions', 'Learn more about our marketing tracking and analytics solutions'),
  ('/services', 'Our Services - Lead Management & SEO', 'services, lead management, seo, analytics', 'Professional lead management and SEO optimization services'),
  ('/contact', 'Contact Us - Get Started Today', 'contact, support, get started', 'Get in touch with our team to start tracking your marketing leads'),
  ('/pricing', 'Pricing Plans - Affordable Marketing Tools', 'pricing, plans, subscription, affordable', 'Choose the perfect plan for your marketing needs');