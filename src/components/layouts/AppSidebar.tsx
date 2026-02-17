import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/types';

import {
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Settings,
  Shield,
  BookOpen,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'sales_manager', 'sales_person', 'seo_manager', 'seo_person', 'client'] as UserRole[] },
  { name: 'Leads', href: '/leads', icon: Users, roles: ['super_admin', 'admin', 'sales_manager', 'sales_person', 'client'] as UserRole[] },
  { name: 'SEO Meta Tags', href: '/seo', icon: Search, roles: ['super_admin', 'admin', 'seo_manager', 'seo_person'] as UserRole[] },
  { name: 'Blogs', href: '/blogs', icon: BookOpen, roles: ['super_admin', 'admin', 'seo_manager', 'seo_person'] as UserRole[] },
  { name: 'Sites', href: '/sites', icon: Globe, roles: ['super_admin'] as UserRole[] },
  { name: 'IP Security', href: '/ip-security', icon: Shield, roles: ['super_admin', 'admin'] as UserRole[] },
  { name: 'Subscription', href: '/subscription', icon: FileText, roles: ['client'] as UserRole[] },
  { name: 'User Management', href: '/users', icon: Settings, roles: ['super_admin', 'admin'] as UserRole[] },
  { name: 'Permissions', href: '/permissions', icon: Shield, roles: ['super_admin'] as UserRole[] },
  { name: 'Activity Logs', href: '/activity', icon: FileText, roles: ['super_admin', 'admin', 'sales_manager', 'seo_manager'] as UserRole[] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { currentSite, setCurrentSite, getAccessibleSites } = useSite();

  // Get sites based on user role
  const accessibleSites = profile
    ? getAccessibleSites(String(profile.id), profile.role)
    : [];

  const filteredNavigation = navigation.filter(item =>
    profile && item.roles.includes(profile.role as UserRole)
  );

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <h1 className="text-lg font-semibold text-sidebar-foreground">Marketing Dashboard</h1>
      </div>

      {/* Site Switcher - Only show if user has access to multiple sites or is super_admin */}
      {accessibleSites.length > 0 && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2 truncate">
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{currentSite?.name || 'Select Site'}</span>
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {accessibleSites.map((site) => (
                <DropdownMenuItem
                  key={site.id}
                  onClick={() => setCurrentSite(site.id)}
                  className={cn(
                    'cursor-pointer',
                    currentSite?.id === site.id && 'bg-accent'
                  )}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  <span className="truncate">{site.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.name} to={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

