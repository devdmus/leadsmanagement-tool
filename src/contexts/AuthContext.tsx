import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Profile, UserRole } from '../types/types';

type Permission = {
  can_read: boolean;
  can_write: boolean;
};

// Per-site credentials map — keyed by site ID
type SiteCredentialsMap = Record<string, { username: string; password: string }>;

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (feature: string, permissionType: 'read' | 'write') => boolean;
  signInWithUsername: (username: string, password: string, siteId?: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getWpAuthHeader: (siteId?: string) => string;
  logActivity: (action: string, details: string) => Promise<void>;
  // Expose per-site credential helpers
  getSiteCredentials: (siteId: string) => { username: string; password: string } | null;
  hasSiteCredentials: (siteId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SITE_CREDS_KEY = 'crm_site_credentials'; // { [siteId]: { username, password } }

// Helper — get current site info from localStorage (used without SiteContext)
function getCurrentSiteInfo(): { id: string; url: string } | null {
  try {
    const currentSiteId = localStorage.getItem('crm_current_site_id');
    const savedSites = localStorage.getItem('crm_wp_sites');
    if (currentSiteId && savedSites) {
      const sites = JSON.parse(savedSites);
      const site = sites.find((s: any) => s.id === currentSiteId);
      if (site?.url) return { id: site.id, url: site.url };
    }
  } catch (_) {}
  return null;
}

// Helper — get wp-json base from a site URL
function toApiBase(siteUrl: string): string {
  return siteUrl.replace(/\/$/, '') + '/wp-json';
}

// Default fallback API base
const DEFAULT_API_BASE = 'https://digitmarketus.com/Bhairavi/wp-json';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('crm_profile');
    return saved ? JSON.parse(saved) : null;
  });

  // Global credentials (for the currently active site session)
  const [wpCredentials, setWpCredentials] = useState<{ username: string; password: string } | null>(() => {
    const saved = localStorage.getItem('wp_credentials');
    return saved ? JSON.parse(saved) : null;
  });

  // Per-site credentials map
  const [siteCredentials, setSiteCredentials] = useState<SiteCredentialsMap>(() => {
    const saved = localStorage.getItem(SITE_CREDS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [loading, setLoading] = useState(false);
  const isAdmin = profile?.role === 'admin';

  // Persist profile
  useEffect(() => {
    if (profile) localStorage.setItem('crm_profile', JSON.stringify(profile));
    else localStorage.removeItem('crm_profile');
  }, [profile]);

  // Persist global credentials
  useEffect(() => {
    if (wpCredentials) localStorage.setItem('wp_credentials', JSON.stringify(wpCredentials));
    else localStorage.removeItem('wp_credentials');
  }, [wpCredentials]);

  // Persist per-site credentials
  useEffect(() => {
    localStorage.setItem(SITE_CREDS_KEY, JSON.stringify(siteCredentials));
  }, [siteCredentials]);

  // ── Permission map ──────────────────────────────────────────────────────────
  const permissions: Record<UserRole, Record<string, Permission>> = {
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
    if (profile.role === 'admin') return true;
    const rolePermissions = permissions[profile.role as UserRole];
    if (!rolePermissions) return false;
    const featurePerms = rolePermissions[feature];
    if (!featurePerms) return false;
    return permissionType === 'read' ? featurePerms.can_read : featurePerms.can_write;
  };

  // ── Credential helpers ──────────────────────────────────────────────────────

  const getSiteCredentials = (siteId: string) => siteCredentials[siteId] ?? null;
  const hasSiteCredentials = (siteId: string) => !!siteCredentials[siteId];

  /**
   * Returns the Basic auth header value.
   * Priority: per-site creds → global creds → ''
   */
  const getWpAuthHeader = (siteId?: string): string => {
    // 1. Try per-site credentials for the given (or current) site
    const targetSiteId = siteId ?? getCurrentSiteInfo()?.id;
    if (targetSiteId && siteCredentials[targetSiteId]) {
      const { username, password } = siteCredentials[targetSiteId];
      return 'Basic ' + btoa(`${username}:${password}`);
    }
    // 2. Fall back to global credentials
    if (wpCredentials) return 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
    return '';
  };

  // ── Sign in ─────────────────────────────────────────────────────────────────

  /**
   * siteId — optional; if provided, validates against that site's WP endpoint
   * and stores credentials under that site ID.
   */
  const signInWithUsername = async (username: string, password: string, siteId?: string) => {
    setLoading(true);
    try {
      const authHeader = 'Basic ' + btoa(`${username}:${password}`);

      // Build the list of sites to try
      // If a specific siteId is given (SiteSwitcher), only try that one.
      // Otherwise (LoginPage), try ALL known sites — whichever accepts the credentials wins.
      let sitesToTry: Array<{ id: string; apiBase: string }> = [];

      if (siteId) {
        // Explicit site — resolve its URL
        let apiBase = DEFAULT_API_BASE;
        try {
          const savedSites = localStorage.getItem('crm_wp_sites');
          if (savedSites) {
            const sites = JSON.parse(savedSites);
            const site = sites.find((s: any) => s.id === siteId);
            if (site?.url) apiBase = toApiBase(site.url);
          }
        } catch (_) {}
        sitesToTry = [{ id: siteId, apiBase }];
      } else {
        // No siteId — try all known sites (default first, then rest)
        try {
          const savedSites = localStorage.getItem('crm_wp_sites');
          if (savedSites) {
            const sites: Array<{ id: string; url: string; isDefault?: boolean }> = JSON.parse(savedSites);
            // Sort: default site first
            const sorted = [...sites].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
            sitesToTry = sorted.map(s => ({ id: s.id, apiBase: toApiBase(s.url) }));
          }
        } catch (_) {}
        // Always include default as fallback even if localStorage is empty
        if (sitesToTry.length === 0) {
          sitesToTry = [{ id: 'default', apiBase: DEFAULT_API_BASE }];
        }
      }

      // Try each site in sequence until one succeeds
      let wpUser: any = null;
      let targetApiBase = DEFAULT_API_BASE;
      let targetSiteId: string | undefined;
      let lastError = 'Invalid credentials — check your username and Application Password.';

      for (const site of sitesToTry) {
        try {
          const response = await fetch(`${site.apiBase}/wp/v2/users/me?context=edit`, {
            headers: { Authorization: authHeader },
          });
          if (response.ok) {
            wpUser = await response.json();
            targetApiBase = site.apiBase;
            targetSiteId = site.id;
            break; // Found the right site
          } else {
            lastError = `Invalid credentials for site ${site.id} (HTTP ${response.status})`;
          }
        } catch (fetchErr) {
          lastError = `Could not reach site ${site.id}`;
        }
      }

      if (!wpUser) {
        throw new Error(lastError);
      }

      // Map WP roles → app roles
      let appRole: UserRole = 'client';
      if (wpUser.roles.includes('administrator')) appRole = 'admin';
      else if (wpUser.roles.includes('editor')) appRole = 'seo_manager';
      else if (wpUser.roles.includes('author')) appRole = 'sales_manager';
      else if (wpUser.roles.includes('contributor')) appRole = 'sales_person';
      else if (wpUser.roles.includes('seo_manager')) appRole = 'seo_manager';
      else if (wpUser.roles.includes('seo_person')) appRole = 'seo_person';

      const newProfile: Profile = {
        id: wpUser.id.toString(),
        username: wpUser.slug || wpUser.name,
        email: wpUser.email || '',
        role: appRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_client_paid: true,
      };

      // Store per-site credentials so future site switches are seamless
      if (targetSiteId) {
        setSiteCredentials(prev => ({
          ...prev,
          [targetSiteId!]: { username, password },
        }));
        // Set the current site to whichever site authenticated the user
        localStorage.setItem('crm_current_site_id', targetSiteId);
      }

      // Also store as global credentials (backward compat + fallback)
      setWpCredentials({ username, password });
      localStorage.setItem('wp_credentials', JSON.stringify({ username, password }));

      // Capture IP + log activity
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        let ip = 'unknown';
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          ip = ipData.ip;
          localStorage.setItem('crm_session_ip', JSON.stringify({
            ip: ipData.ip,
            userId: newProfile.id,
            loginTime: new Date().toISOString(),
          }));
        }

        const { createWordPressApi } = await import('../db/wordpressApi');
        const loginApi = createWordPressApi(targetApiBase, { Authorization: authHeader });
        await loginApi.logActivity(
          'login',
          `User ${newProfile.username} logged in from IP ${ip}`,
          { Authorization: authHeader }
        );

        // Local fallback log
        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({ action: 'login', ip, userId: newProfile.id, username: newProfile.username, timestamp: new Date().toISOString() });
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
      } catch (ipErr) {
        console.warn('Could not capture IP or log activity:', ipErr);
      }

      setProfile(newProfile);
      return { error: null };
    } catch (err: any) {
      console.error('Login Error:', err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────────

  const signOut = async () => {
    if (profile && wpCredentials) {
      try {
        const { createWordPressApi } = await import('../db/wordpressApi');
        const authHeader = 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
        const currentSite = getCurrentSiteInfo();
        const apiBase = currentSite ? toApiBase(currentSite.url) : DEFAULT_API_BASE;
        const logoutApi = createWordPressApi(apiBase, { Authorization: authHeader });
        await logoutApi.logActivity('logout', `User ${profile.username} logged out`, { Authorization: authHeader });
      } catch (e) {
        console.warn('Failed to log logout:', e);
      }
    }

    setProfile(null);
    setWpCredentials(null);
    // NOTE: We intentionally keep siteCredentials so the user can quickly
    // log back into any site without re-entering credentials.
    localStorage.removeItem('wp_credentials');
    localStorage.removeItem('crm_session_ip');
    localStorage.removeItem('crm_profile');
  };

  const signUpWithUsername = async () => ({ error: new Error('Signup must be done via WordPress Admin') });

  const refreshProfile = async () => {
    if (wpCredentials) {
      await signInWithUsername(wpCredentials.username, wpCredentials.password);
    }
  };

  // ── Activity logging ────────────────────────────────────────────────────────

  const logActivity = async (action: string, details: string) => {
    try {
      const { createWordPressApi } = await import('../db/wordpressApi');
      const authHeaderValue = getWpAuthHeader();
      const currentSite = getCurrentSiteInfo();
      const apiBase = currentSite ? toApiBase(currentSite.url) : DEFAULT_API_BASE;
      const api = createWordPressApi(apiBase, authHeaderValue ? { Authorization: authHeaderValue } : {});
      await api.logActivity(action, details, authHeaderValue ? { Authorization: authHeaderValue } : undefined);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      profile,
      loading,
      isAdmin,
      hasPermission,
      signInWithUsername,
      signUpWithUsername,
      signOut,
      refreshProfile,
      getWpAuthHeader,
      logActivity,
      getSiteCredentials,
      hasSiteCredentials,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
