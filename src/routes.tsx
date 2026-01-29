import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import SeoPage from './pages/SeoPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';
import ActivityPage from './pages/ActivityPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Dashboard',
    path: '/',
    element: <DashboardPage />
  },
  {
    name: 'Leads',
    path: '/leads',
    element: <LeadsPage />
  },
  {
    name: 'Lead Detail',
    path: '/leads/:id',
    element: <LeadDetailPage />
  },
  {
    name: 'SEO Meta Tags',
    path: '/seo',
    element: <SeoPage />
  },
  {
    name: 'User Management',
    path: '/users',
    element: <UsersPage />
  },
  {
    name: 'Permissions',
    path: '/permissions',
    element: <PermissionsPage />
  },
  {
    name: 'Activity Logs',
    path: '/activity',
    element: <ActivityPage />
  },
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />
  }
];

export default routes;
