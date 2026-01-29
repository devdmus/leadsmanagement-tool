import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};
import {
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Settings,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'sales', 'seo', 'client'] },
  { name: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'sales', 'seo', 'client'] },
  { name: 'SEO Meta Tags', href: '/seo', icon: Search, roles: ['admin', 'seo'] },
  { name: 'User Management', href: '/users', icon: Settings, roles: ['admin'] },
  { name: 'Permissions', href: '/permissions', icon: Shield, roles: ['admin'] },
  { name: 'Activity Logs', href: '/activity', icon: FileText, roles: ['admin', 'sales', 'seo'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile } = useAuth();

  const filteredNavigation = navigation.filter(item => 
    profile && item.roles.includes(profile.role as UserRole)
  );

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <h1 className="text-lg font-semibold text-sidebar-foreground">Marketing Dashboard</h1>
      </div>
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
