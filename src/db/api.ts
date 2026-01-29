import { supabase } from './supabase';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo';
type LeadStatus = 'pending' | 'completed' | 'remainder';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};

type Lead = {
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

type SeoMetaTag = {
  id: string;
  page_identifier: string;
  title: string;
  keywords: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type Note = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type Message = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ActivityLog = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type RolePermission = {
  id: string;
  role: UserRole;
  feature: string;
  can_read: boolean;
  can_write: boolean;
  created_at: string;
  updated_at: string;
};

type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

type NoteWithUser = Note & {
  user?: Profile;
};

type MessageWithUser = Message & {
  user?: Profile;
};

// Profiles API
export const profilesApi = {
  getAll: async (): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getById: async (id: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<Profile>): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
};

// Leads API
export const leadsApi = {
  getAll: async (): Promise<LeadWithAssignee[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assignee:profiles!leads_assigned_to_fkey(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getById: async (id: string): Promise<LeadWithAssignee | null> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assignee:profiles!leads_assigned_to_fkey(*)
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  getByAssignee: async (userId: string): Promise<LeadWithAssignee[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assignee:profiles!leads_assigned_to_fkey(*)
      `)
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getByStatus: async (status: LeadStatus): Promise<LeadWithAssignee[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assignee:profiles!leads_assigned_to_fkey(*)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getBySource: async (source: LeadSource): Promise<LeadWithAssignee[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assignee:profiles!leads_assigned_to_fkey(*)
      `)
      .eq('source', source)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Promise<Lead | null> => {
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  getStats: async () => {
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('status, source');
    
    if (error) throw error;
    
    const leads = Array.isArray(allLeads) ? allLeads : [];
    
    return {
      total: leads.length,
      pending: leads.filter(l => l.status === 'pending').length,
      completed: leads.filter(l => l.status === 'completed').length,
      remainder: leads.filter(l => l.status === 'remainder').length,
      bySource: {
        facebook: leads.filter(l => l.source === 'facebook').length,
        linkedin: leads.filter(l => l.source === 'linkedin').length,
        form: leads.filter(l => l.source === 'form').length,
        seo: leads.filter(l => l.source === 'seo').length,
      },
    };
  },
};

// SEO Meta Tags API
export const seoMetaTagsApi = {
  getAll: async (): Promise<SeoMetaTag[]> => {
    const { data, error } = await supabase
      .from('seo_meta_tags')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getById: async (id: string): Promise<SeoMetaTag | null> => {
    const { data, error } = await supabase
      .from('seo_meta_tags')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  getByPageIdentifier: async (pageIdentifier: string): Promise<SeoMetaTag | null> => {
    const { data, error } = await supabase
      .from('seo_meta_tags')
      .select('*')
      .eq('page_identifier', pageIdentifier)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  create: async (tag: Omit<SeoMetaTag, 'id' | 'created_at' | 'updated_at'>): Promise<SeoMetaTag | null> => {
    const { data, error } = await supabase
      .from('seo_meta_tags')
      .insert(tag)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<SeoMetaTag>): Promise<SeoMetaTag | null> => {
    const { data, error } = await supabase
      .from('seo_meta_tags')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('seo_meta_tags')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// Notes API
export const notesApi = {
  getByLeadId: async (leadId: string): Promise<NoteWithUser[]> => {
    const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        user:profiles!notes_user_id_fkey(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (note: Omit<Note, 'id' | 'created_at'>): Promise<Note | null> => {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, content: string): Promise<Note | null> => {
    const { data, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// Messages API
export const messagesApi = {
  getByLeadId: async (leadId: string): Promise<MessageWithUser[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        user:profiles!messages_user_id_fkey(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (message: Omit<Message, 'id' | 'created_at'>): Promise<Message | null> => {
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, content: string): Promise<Message | null> => {
    const { data, error } = await supabase
      .from('messages')
      .update({ content })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// Activity Logs API
export const activityLogsApi = {
  getAll: async (limit = 100): Promise<ActivityLog[]> => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getByUserId: async (userId: string, limit = 50): Promise<ActivityLog[]> => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase
      .from('activity_logs')
      .insert(log);
    
    if (error) throw error;
  },
};

// Role Permissions API
export const rolePermissionsApi = {
  getAll: async (): Promise<RolePermission[]> => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role', { ascending: true });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  getByRole: async (role: UserRole): Promise<RolePermission[]> => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', role);
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  update: async (id: string, updates: Partial<RolePermission>): Promise<RolePermission | null> => {
    const { data, error } = await supabase
      .from('role_permissions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
};

// Subscription Plans API
export const subscriptionPlansApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  updateProfileSubscription: async (userId: string, planId: string, startDate: string, endDate: string) => {
    // Use raw SQL update to bypass type checking
    const { error } = await supabase.rpc('exec_sql', {
      sql: `UPDATE profiles SET subscription_plan_id = '${planId}', subscription_start_date = '${startDate}', subscription_end_date = '${endDate}', is_client_paid = true WHERE id = '${userId}'`
    });
    
    if (error) {
      // Fallback to direct update with type assertion
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_plan_id: planId,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
          is_client_paid: true,
        } as never)
        .eq('id', userId);
      
      if (updateError) throw updateError;
    }
  },
};
