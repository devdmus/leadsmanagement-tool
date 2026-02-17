import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPageEnhanced from './pages/LeadsPageEnhanced';
import LeadDetailPage from './pages/LeadDetailPage';
import SeoPage from './pages/SeoPage';
import BlogsPage from './pages/BlogsPage';
import SitesPage from './pages/SitesPage';
import IPSecurityPage from './pages/IPSecurityPage';
import UsersPage from './pages/UsersPage';
import UserProfilePage from './pages/UserProfilePage';
import ProfilePage from './pages/ProfilePage';
import PermissionsPage from './pages/PermissionsPage';
import ActivityPage from './pages/ActivityPage';
import SubscriptionPage from './pages/SubscriptionPage';
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
    element: <LeadsPageEnhanced />
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
    name: 'Blogs',
    path: '/blogs',
    element: <BlogsPage />
  },
  {
    name: 'Sites',
    path: '/sites',
    element: <SitesPage />
  },
  {
    name: 'IP Security',
    path: '/ip-security',
    element: <IPSecurityPage />
  },
  {
    name: 'User Management',
    path: '/users',
    element: <UsersPage />
  },
  {
    name: 'User Profile',
    path: '/users/:id',
    element: <UserProfilePage />
  },
  {
    name: 'My Profile',
    path: '/profile',
    element: <ProfilePage />
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
    name: 'Subscription',
    path: '/subscription',
    element: <SubscriptionPage />
  },
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />
  },
  {
    name: 'Forgot Password',
    path: '/forgot-password',
    element: <ForgotPasswordPage />
  },
  {
    name: 'Reset Password',
    path: '/reset-password',
    element: <ResetPasswordPage />
  }
];

export default routes;

