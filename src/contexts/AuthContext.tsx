import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Profile, UserRole } from '../types/types';



type Permission = {
  can_read: boolean;
  can_write: boolean;
};

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasPermission: (feature: string, permissionType: 'read' | 'write') => boolean;

  // placeholders (WordPress auth later)
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getWpAuthHeader: () => string;
  logActivity: (action: string, details: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('crm_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [wpCredentials, setWpCredentials] = useState<{ username: string, password: string } | null>(() => {
    const saved = localStorage.getItem('wp_credentials');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  // Persistence
  useEffect(() => {
    if (profile) {
      localStorage.setItem('crm_profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('crm_profile');
    }
  }, [profile]);

  useEffect(() => {
    if (wpCredentials) {
      localStorage.setItem('wp_credentials', JSON.stringify(wpCredentials));
    } else {
      localStorage.removeItem('wp_credentials');
    }
  }, [wpCredentials]);

  // 🔐 Static permission map
  const permissions: Record<UserRole, Record<string, Permission>> = {
    super_admin: {
      leads: { can_read: true, can_write: true },
      users: { can_read: true, can_write: true },
      activity_logs: { can_read: true, can_write: true },
      subscriptions: { can_read: true, can_write: true },
      seo_meta_tags: { can_read: true, can_write: true },
      blogs: { can_read: true, can_write: true },
    },
    admin: {
      leads: { can_read: true, can_write: true },
      users: { can_read: true, can_write: true },
      activity_logs: { can_read: true, can_write: true },
      subscriptions: { can_read: true, can_write: true },
      seo_meta_tags: { can_read: true, can_write: true },
      blogs: { can_read: true, can_write: true },
    },
    sales_manager: {
      leads: { can_read: true, can_write: true },
      users: { can_read: true, can_write: false },
      activity_logs: { can_read: false, can_write: false },
      subscriptions: { can_read: false, can_write: false },
      seo_meta_tags: { can_read: false, can_write: false },
      blogs: { can_read: false, can_write: false },
    },
    sales_person: {
      leads: { can_read: true, can_write: true },
      users: { can_read: true, can_write: false },
      activity_logs: { can_read: false, can_write: false },
      subscriptions: { can_read: false, can_write: false },
      seo_meta_tags: { can_read: false, can_write: false },
      blogs: { can_read: false, can_write: false },
    },
    seo_manager: {
      leads: { can_read: false, can_write: false },
      users: { can_read: true, can_write: false },
      activity_logs: { can_read: false, can_write: false },
      subscriptions: { can_read: false, can_write: false },
      seo_meta_tags: { can_read: true, can_write: true },
      blogs: { can_read: true, can_write: true },
    },
    seo_person: {
      leads: { can_read: false, can_write: false },
      users: { can_read: true, can_write: false },
      activity_logs: { can_read: false, can_write: false },
      subscriptions: { can_read: false, can_write: false },
      seo_meta_tags: { can_read: true, can_write: true },
      blogs: { can_read: true, can_write: true },
    },
    client: {
      leads: { can_read: true, can_write: false },
      users: { can_read: false, can_write: false },
      activity_logs: { can_read: false, can_write: false },
      subscriptions: { can_read: true, can_write: false },
      seo_meta_tags: { can_read: false, can_write: false },
      blogs: { can_read: false, can_write: false },
    },
  };

  const hasPermission = (feature: string, permissionType: 'read' | 'write') => {
    if (!profile) return false;
    // Admins have full access
    if (profile.role === 'admin') return true;

    // Check role-based permissions
    const rolePermissions = permissions[profile.role as UserRole];
    if (!rolePermissions) return false;

    // If exact feature is not found, default to false
    const featurePerms = rolePermissions[feature];
    if (!featurePerms) return false;

    return permissionType === 'read' ? featurePerms.can_read : featurePerms.can_write;
  };

  const getWpAuthHeader = () => {
    if (!wpCredentials) return '';
    return 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
  };

  const signInWithUsername = async (username: string, password: string) => { // Password should be Application Password
    setLoading(true);
    try {
      const authHeader = 'Basic ' + btoa(`${username}:${password}`);
      const response = await fetch('https://digitmarketus.com/Bhairavi/wp-json/wp/v2/users/me?context=edit', {
        headers: {
          'Authorization': authHeader
        }
      });

      if (!response.ok) {
        throw new Error('Invalid credentials or WordPress error');
      }

      const wpUser = await response.json();

      // Determine role based on WP roles
      let appRole: UserRole = 'client';
      if (wpUser.roles.includes('administrator')) appRole = 'admin';
      else if (wpUser.roles.includes('editor')) appRole = 'seo_manager';
      else if (wpUser.roles.includes('author')) appRole = 'sales_manager';
      else if (wpUser.roles.includes('contributor')) appRole = 'sales_person';
      else if (wpUser.roles.includes('seo_manager')) appRole = 'seo_manager'; // Custom role fallback
      else if (wpUser.roles.includes('seo_person')) appRole = 'seo_person'; // Custom role fallback
      else if (wpUser.roles.includes('super_admin')) appRole = 'super_admin'; // Super admin mapping

      const newProfile: Profile = {
        id: wpUser.id.toString(),
        username: wpUser.slug || wpUser.name,
        email: wpUser.email || '', // Email might not be visible depending on context
        role: appRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_client_paid: true // Default
      };

      // Capture and save IP address for session security
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        let ip = 'unknown';
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          ip = ipData.ip;
          const sessionData = {
            ip: ipData.ip,
            userId: newProfile.id,
            loginTime: new Date().toISOString(),
          };
          localStorage.setItem('crm_session_ip', JSON.stringify(sessionData));
        }

        // Log the login activity server-side with explicit credentials
        const { wordpressApi } = await import('../db/wordpressApi');
        const authHeader = 'Basic ' + btoa(`${username}:${password}`);
        await wordpressApi.logActivity(
          'login',
          `User ${newProfile.username} logged in from IP ${ip}`,
          { Authorization: authHeader }
        );

        // Legacy local logging (keeping for fallback/compatibility)
        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({
          action: 'login',
          ip: ip,
          userId: newProfile.id,
          username: newProfile.username,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
      } catch (ipError) {
        console.warn('Could not capture IP address or log activity:', ipError);
      }

      setProfile(newProfile);
      setWpCredentials({ username, password });
      localStorage.setItem('wp_credentials', JSON.stringify({ username, password }));

      return { error: null };
    } catch (err: any) {
      console.error("Login Error:", err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };


  const signUpWithUsername = async () => ({ error: new Error("Signup must be done via WordPress Admin") });

  const signOut = async () => {
    // Log logout BEFORE clearing credentials
    if (profile && wpCredentials) {
      try {
        const { wordpressApi } = await import('../db/wordpressApi');
        const authHeader = 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
        await wordpressApi.logActivity(
          'logout',
          `User ${profile.username} logged out`,
          { Authorization: authHeader }
        );
      } catch (e) {
        console.warn('Failed to log logout:', e);
      }
    }

    setProfile(null);
    setWpCredentials(null);
    localStorage.removeItem('wp_credentials');
    localStorage.removeItem('crm_session_ip');
    localStorage.removeItem('crm_profile');
  };

  const refreshProfile = async () => {
    if (wpCredentials) {
      await signInWithUsername(wpCredentials.username, wpCredentials.password);
    }
  };

  const logActivity = async (action: string, details: string) => {
    try {
      const { wordpressApi } = await import('../db/wordpressApi');
      // Use state credentials if available, otherwise fallback to localStorage
      let authHeaderValue = '';
      if (wpCredentials) {
        authHeaderValue = 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
      } else {
        const saved = localStorage.getItem('wp_credentials');
        if (saved) {
          const creds = JSON.parse(saved);
          authHeaderValue = 'Basic ' + btoa(`${creds.username}:${creds.password}`);
        }
      }

      await wordpressApi.logActivity(
        action,
        details,
        authHeaderValue ? { Authorization: authHeaderValue } : undefined
      );
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        isAdmin,
        isSuperAdmin,
        hasPermission,
        signInWithUsername,
        signUpWithUsername,
        signOut,
        refreshProfile,
        getWpAuthHeader,
        logActivity
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
