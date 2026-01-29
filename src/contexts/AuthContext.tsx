import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';

type RolePermission = {
  feature: string;
  can_read: boolean;
  can_write: boolean;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (feature: string, permissionType: 'read' | 'write') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, { can_read: boolean; can_write: boolean }>>({});

  const isAdmin = profile?.role === 'admin';

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      setPermissions({});
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);

    if (profileData) {
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', profileData.role as string);

      if (perms && Array.isArray(perms)) {
        const permMap: Record<string, { can_read: boolean; can_write: boolean }> = {};
        for (const perm of perms as RolePermission[]) {
          permMap[perm.feature] = {
            can_read: perm.can_read,
            can_write: perm.can_write,
          };
        }
        setPermissions(permMap);
      }
    }
  };

  const hasPermission = (feature: string, permissionType: 'read' | 'write'): boolean => {
    if (isAdmin) return true;
    const perm = permissions[feature];
    if (!perm) return false;
    return permissionType === 'read' ? perm.can_read : perm.can_write;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(async (profileData) => {
          setProfile(profileData);
          if (profileData) {
            const { data: perms } = await supabase
              .from('role_permissions')
              .select('*')
              .eq('role', profileData.role as string);

            if (perms && Array.isArray(perms)) {
              const permMap: Record<string, { can_read: boolean; can_write: boolean }> = {};
              for (const perm of perms as RolePermission[]) {
                permMap[perm.feature] = {
                  can_read: perm.can_read,
                  can_write: perm.can_write,
                };
              }
              setPermissions(permMap);
            }
          }
        });
      }
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(async (profileData) => {
          setProfile(profileData);
          if (profileData) {
            const { data: perms } = await supabase
              .from('role_permissions')
              .select('*')
              .eq('role', profileData.role as string);

            if (perms && Array.isArray(perms)) {
              const permMap: Record<string, { can_read: boolean; can_write: boolean }> = {};
              for (const perm of perms as RolePermission[]) {
                permMap[perm.feature] = {
                  can_read: perm.can_read,
                  can_write: perm.can_write,
                };
              }
              setPermissions(permMap);
            }
          }
        });
      } else {
        setProfile(null);
        setPermissions({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions({});
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin,
      signInWithUsername, 
      signUpWithUsername, 
      signOut, 
      refreshProfile,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
