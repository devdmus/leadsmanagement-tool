import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = ['/login', '/403', '/404'];

// Map routes to feature permission requirements
const ROUTE_FEATURE_MAP: Record<string, { feature: string; permission: 'read' | 'write' }> = {
  '/leads': { feature: 'leads', permission: 'read' },
  '/seo': { feature: 'seo_meta_tags', permission: 'read' },
  '/blogs': { feature: 'blogs', permission: 'read' },
  '/sites': { feature: 'sites', permission: 'read' },
  '/ip-security': { feature: 'ip_security', permission: 'read' },
  '/users': { feature: 'users', permission: 'read' },
  '/activity': { feature: 'activity_logs', permission: 'read' },
  '/subscription': { feature: 'subscriptions', permission: 'read' },
};

function matchPublicRoute(path: string, patterns: string[]) {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      return regex.test(path);
    }
    return path === pattern;
  });
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { profile, loading, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    const isPublic = matchPublicRoute(location.pathname, PUBLIC_ROUTES);

    if (!profile && !isPublic) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
      return;
    }

    if (profile) {
      // Permissions page: super_admin only
      if (location.pathname === '/permissions' && profile.role !== 'super_admin') {
        navigate('/', { replace: true });
        return;
      }

      // Feature-level route guard
      const routeConfig = ROUTE_FEATURE_MAP[location.pathname];
      if (routeConfig && !hasPermission(routeConfig.feature, routeConfig.permission)) {
        navigate('/', { replace: true });
        return;
      }
    }
  }, [profile, loading, location.pathname, navigate, hasPermission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
