import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Profile, UserRole, PermissionMatrix } from '../types/types';
import { superAdminApi } from '../services/superAdminApi';
import { getCurrentSiteFromCache, getAllSitesFromCache } from '../utils/siteCache';


// Per-site credentials map — keyed by site ID
type SiteCredentialsMap = Record<string, { username: string; password: string }>;

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  superAdminToken: string | null;
  permissionMatrix: PermissionMatrix | null;
  hasPermission: (feature: string, permissionType: 'read' | 'write') => boolean;
  signInWithUsername: (username: string, password: string, siteId?: string) => Promise<{ error: Error | null }>;
  signInAsSuperAdmin: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  getWpAuthHeader: (siteId?: string) => string;
  logActivity: (action: string, details: string) => Promise<void>;
  getSiteCredentials: (siteId: string) => { username: string; password: string } | null;
  hasSiteCredentials: (siteId: string) => boolean;
  userType: 'super_admin' | 'wp_user' | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SITE_CREDS_KEY = 'crm_site_credentials';

// Helper — get current site info from siteCache (replaces localStorage lookup)
function getCurrentSiteInfo(): { id: string; url: string } | null {
  try {
    const site = getCurrentSiteFromCache();
    if (site?.url) return { id: site.id, url: site.url };
  } catch (_) { }
  return null;
}

// Helper — get wp-json base from a site URL
function toApiBase(siteUrl: string): string {
  return siteUrl.replace(/\/$/, '') + '/wp-json';
}

// ── Hardcoded default permissions (fallback when Express backend is unreachable) ──
const HARDCODED_DEFAULT_PERMISSIONS: PermissionMatrix = {
  super_admin: {
    leads: { can_read: true, can_write: true },
    users: { can_read: true, can_write: true },
    activity_logs: { can_read: true, can_write: true },
    subscriptions: { can_read: true, can_write: true },
    seo_meta_tags: { can_read: true, can_write: true },
    blogs: { can_read: true, can_write: true },
    sites: { can_read: true, can_write: true },
    ip_security: { can_read: true, can_write: true },
    permissions: { can_read: true, can_write: true },
  },
  admin: {
    leads: { can_read: true, can_write: true },
    users: { can_read: true, can_write: true },
    activity_logs: { can_read: true, can_write: true },
    subscriptions: { can_read: true, can_write: true },
    seo_meta_tags: { can_read: true, can_write: true },
    blogs: { can_read: true, can_write: true },
    sites: { can_read: true, can_write: true },
    ip_security: { can_read: true, can_write: true },
    permissions: { can_read: false, can_write: false },
  },
  lead_manager: {
    leads: { can_read: true, can_write: true },
    users: { can_read: true, can_write: false },
    activity_logs: { can_read: true, can_write: false },
    subscriptions: { can_read: false, can_write: false },
    seo_meta_tags: { can_read: false, can_write: false },
    blogs: { can_read: false, can_write: false },
    sites: { can_read: false, can_write: false },
    ip_security: { can_read: false, can_write: false },
    permissions: { can_read: false, can_write: false },
  },
  seo_manager: {
    leads: { can_read: false, can_write: false },
    users: { can_read: true, can_write: false },
    activity_logs: { can_read: true, can_write: false },
    subscriptions: { can_read: false, can_write: false },
    seo_meta_tags: { can_read: true, can_write: true },
    blogs: { can_read: true, can_write: true },
    sites: { can_read: false, can_write: false },
    ip_security: { can_read: false, can_write: false },
    permissions: { can_read: false, can_write: false },
  },
  sales_person: {
    leads: { can_read: true, can_write: true },
    users: { can_read: true, can_write: false },
    activity_logs: { can_read: false, can_write: false },
    subscriptions: { can_read: false, can_write: false },
    seo_meta_tags: { can_read: false, can_write: false },
    blogs: { can_read: false, can_write: false },
    sites: { can_read: false, can_write: false },
    ip_security: { can_read: false, can_write: false },
    permissions: { can_read: false, can_write: false },
  },
  seo_person: {
    leads: { can_read: false, can_write: false },
    users: { can_read: true, can_write: false },
    activity_logs: { can_read: false, can_write: false },
    subscriptions: { can_read: false, can_write: false },
    seo_meta_tags: { can_read: true, can_write: true },
    blogs: { can_read: true, can_write: true },
    sites: { can_read: false, can_write: false },
    ip_security: { can_read: false, can_write: false },
    permissions: { can_read: false, can_write: false },
  },
  client: {
    leads: { can_read: true, can_write: false },
    users: { can_read: false, can_write: false },
    activity_logs: { can_read: false, can_write: false },
    subscriptions: { can_read: true, can_write: false },
    seo_meta_tags: { can_read: false, can_write: false },
    blogs: { can_read: false, can_write: false },
    sites: { can_read: false, can_write: false },
    ip_security: { can_read: false, can_write: false },
    permissions: { can_read: false, can_write: false },
  },
};

// Build a PermissionMatrix from flat API rows
function buildMatrixFromRows(rows: Array<{ role: string; feature: string; can_read: boolean; can_write: boolean }>): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const row of rows) {
    if (!matrix[row.role]) matrix[row.role] = {};
    matrix[row.role][row.feature] = {
      can_read: !!row.can_read,
      can_write: !!row.can_write,
    };
  }
  // Always ensure super_admin has full access
  matrix['super_admin'] = HARDCODED_DEFAULT_PERMISSIONS['super_admin'];
  return matrix;
}

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

  // Super admin JWT token
  const [superAdminToken, setSuperAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('crm_sa_token');
  });

  // Dynamic permission matrix (loaded from Express backend)
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix | null>(null);

  const [loading, setLoading] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;

  // ── localStorage migration for old role names ──────────────────────────────
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('crm_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.role === 'sales_manager') {
          parsed.role = 'lead_manager';
          localStorage.setItem('crm_profile', JSON.stringify(parsed));
          setProfile(parsed);
        }
      }
    } catch (_) { }
  }, []);

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

  // Persist super admin token
  useEffect(() => {
    if (superAdminToken) localStorage.setItem('crm_sa_token', superAdminToken);
    else localStorage.removeItem('crm_sa_token');
  }, [superAdminToken]);

  // ── Load permission matrix from Express backend on mount ──────────────────
  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const rows = await superAdminApi.getPermissions();
      const matrix = buildMatrixFromRows(rows);
      setPermissionMatrix(matrix);
    } catch {
      // Backend unreachable — use hardcoded defaults
      setPermissionMatrix(HARDCODED_DEFAULT_PERMISSIONS);
    }
  };

  const refreshPermissions = async () => {
    await loadPermissions();
  };

  // ── Restore super admin session on mount ──────────────────────────────────
  useEffect(() => {
    if (superAdminToken && profile?.role === 'super_admin') {
      // Validate the token is still valid
      superAdminApi.getMe(superAdminToken).catch(() => {
        // Token expired — clear session
        setSuperAdminToken(null);
        setProfile(null);
        localStorage.removeItem('crm_sa_token');
        localStorage.removeItem('crm_profile');
      });
    }
  }, []);

  // ── Session validity polling (single-session enforcement for non-super-admin) ──
  useEffect(() => {
    // Super admin is exempt from session management
    if (!profile || profile.role === 'super_admin') return;

    // Only poll for users with a super admin token (backend-authenticated users)
    // WordPress users rely on idle timeout only since they don't have backend sessions
    if (!superAdminToken) return;

    const interval = setInterval(async () => {
      const isValid = await superAdminApi.checkSessionValid(superAdminToken);
      if (!isValid) {
        // Session was invalidated (e.g., user logged in from another device)
        clearInterval(interval);
        setProfile(null);
        setSuperAdminToken(null);
        localStorage.removeItem('crm_sa_token');
        localStorage.removeItem('crm_profile');
        window.location.href = '/login?reason=session_invalidated';
      }
    }, 60_000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [superAdminToken, profile?.role]);

  // ── Permission check ────────────────────────────────────────────────────────
  const hasPermission = (feature: string, permissionType: 'read' | 'write') => {
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;

    const matrix = permissionMatrix ?? HARDCODED_DEFAULT_PERMISSIONS;
    const rolePerms = matrix[profile.role];
    if (!rolePerms) return false;
    const featurePerms = rolePerms[feature];
    if (!featurePerms) return false;
    return permissionType === 'read' ? featurePerms.can_read : featurePerms.can_write;
  };

  // ── Credential helpers ──────────────────────────────────────────────────────

  const getSiteCredentials = (siteId: string) => siteCredentials[siteId] ?? null;
  const hasSiteCredentials = (siteId: string) => {
    // 1. Check for personal session credentials
    if (!!siteCredentials[siteId]) return true;

    // 2. Super admins can use site-level credentials from DB
    if (isSuperAdmin) {
      const site = getAllSitesFromCache().find(s => s.id === siteId);
      return !!(site?.username && site?.appPassword);
    }

    return false;
  };

  const getWpAuthHeader = (siteId?: string): string => {
    const targetSiteId = siteId ?? getCurrentSiteInfo()?.id;
    if (!targetSiteId) return '';

    // 1. Try personal session credentials first
    if (siteCredentials[targetSiteId]) {
      const { username, password } = siteCredentials[targetSiteId];
      return 'Basic ' + btoa(`${username}:${password}`);
    }

    // 2. For Super Admins, fallback to site-level credentials from DB
    if (isSuperAdmin) {
      const site = getAllSitesFromCache().find(s => s.id === targetSiteId);
      if (site?.username && site?.appPassword) {
        return 'Basic ' + btoa(`${site.username}:${site.appPassword}`);
      }
    }

    // 3. Fallback: use global credentials if stored
    if (wpCredentials) return 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
    return '';
  };

  // ── Super Admin Sign In ───────────────────────────────────────────────────

  const signInAsSuperAdmin = async (username: string, password: string) => {
    setLoading(true);
    try {
      const { token, profile: saProfile } = await superAdminApi.login(username, password);

      const newProfile: Profile = {
        id: saProfile.id.toString(),
        username: saProfile.username,
        email: saProfile.email,
        role: 'super_admin',
        is_client_paid: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSuperAdminToken(token);
      setProfile(newProfile);

      // Refresh permissions after super admin login
      await loadPermissions();

      return { error: null };
    } catch (err: any) {
      console.error('Super Admin Login Error:', err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  // ── WordPress Sign In ─────────────────────────────────────────────────────

  const signInWithUsername = async (username: string, password: string, siteId?: string) => {
    setLoading(true);
    try {
      const authHeader = 'Basic ' + btoa(`${username}:${password}`);

      let sitesToTry: Array<{ id: string; apiBase: string }> = [];

      if (siteId) {
        // Try only the specified site
        const site = getAllSitesFromCache().find(s => s.id === siteId);
        if (site?.url) {
          sitesToTry = [{ id: siteId, apiBase: toApiBase(site.url) }];
        }
        if (sitesToTry.length === 0) {
          throw new Error('Site not found. Please ask your Super Admin to configure sites.');
        }
      } else {
        // Auto-detect: try ALL configured sites
        const allSites = getAllSitesFromCache();
        sitesToTry = allSites.map(s => ({ id: s.id, apiBase: toApiBase(s.url) }));
        if (sitesToTry.length === 0) {
          throw new Error('No sites configured. Please ask the Super Admin to add sites first.');
        }
      }

      let wpUser: any = null;
      let targetApiBase = '';
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
            break;
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
      else if (wpUser.roles.includes('author')) appRole = 'lead_manager';
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

      if (targetSiteId) {
        setSiteCredentials(prev => ({
          ...prev,
          [targetSiteId!]: { username, password },
        }));
        localStorage.setItem('crm_current_site_id', targetSiteId);
      }

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

        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({ action: 'login', ip, userId: newProfile.id, username: newProfile.username, timestamp: new Date().toISOString() });
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
      } catch (ipErr) {
        console.warn('Could not capture IP or log activity:', ipErr);
      }

      // Clear any super admin token when logging in as WP user
      setSuperAdminToken(null);

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
    // Invalidate session on backend for super admin
    if (superAdminToken) {
      try {
        await superAdminApi.logout(superAdminToken);
      } catch {
        // Continue with client-side logout regardless
      }
    }

    if (profile && wpCredentials && profile.role !== 'super_admin') {
      try {
        const { createWordPressApi } = await import('../db/wordpressApi');
        const authHeader = 'Basic ' + btoa(`${wpCredentials.username}:${wpCredentials.password}`);
        const currentSite = getCurrentSiteInfo();
        if (currentSite) {
          const apiBase = toApiBase(currentSite.url);
          const logoutApi = createWordPressApi(apiBase, { Authorization: authHeader });
          await logoutApi.logActivity('logout', `User ${profile.username} logged out`, { Authorization: authHeader });
        }
      } catch (e) {
        console.warn('Failed to log logout:', e);
      }
    }

    setProfile(null);
    setWpCredentials(null);
    setSuperAdminToken(null);
    localStorage.removeItem('wp_credentials');
    localStorage.removeItem('crm_session_ip');
    localStorage.removeItem('crm_profile');
    localStorage.removeItem('crm_sa_token');
  };

  const signUpWithUsername = async () => ({ error: new Error('Signup must be done via WordPress Admin') });

  const refreshProfile = async () => {
    if (superAdminToken && profile?.role === 'super_admin') {
      try {
        const saProfile = await superAdminApi.getMe(superAdminToken);
        setProfile({
          id: saProfile.id.toString(),
          username: saProfile.username,
          email: saProfile.email,
          role: 'super_admin',
          is_client_paid: true,
          created_at: profile.created_at,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Token expired
        await signOut();
      }
    } else if (wpCredentials) {
      await signInWithUsername(wpCredentials.username, wpCredentials.password);
    }
  };

  // ── Activity logging ────────────────────────────────────────────────────────

  const logActivity = async (action: string, details: string) => {
    try {
      const currentSite = getCurrentSiteInfo();
      if (!currentSite) return; // No site available — skip logging
      const { createWordPressApi } = await import('../db/wordpressApi');
      const authHeaderValue = getWpAuthHeader();
      const apiBase = toApiBase(currentSite.url);
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
      isSuperAdmin,
      superAdminToken,
      permissionMatrix,
      hasPermission,
      signInWithUsername,
      signInAsSuperAdmin,
      signUpWithUsername,
      signOut,
      refreshProfile,
      refreshPermissions,
      getWpAuthHeader,
      logActivity,
      getSiteCredentials,
      hasSiteCredentials,
      userType: isSuperAdmin ? 'super_admin' : (profile ? 'wp_user' : null),
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
