import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2, RefreshCw, KeyRound, Settings } from 'lucide-react';
import { createWordPressApi } from '@/db/wordpressApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

export default function UsersPage() {
  const { hasPermission, isAdmin, getWpAuthHeader } = useAuth();
  const { currentSite, getApiBase, getAuthHeader } = useSite();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noCredentials, setNoCredentials] = useState(false);

  // Re-fetch whenever the selected site changes
  useEffect(() => {
    loadUsers();
  }, [currentSite?.id]);

  const loadUsers = async () => {
    setLoading(true);
    setNoCredentials(false);

    // If the current site has no dedicated credentials, the global credentials
    // belong to a different WordPress install and will be rejected — skip the fetch.
    if (currentSite && !currentSite.isDefault && !currentSite.username) {
      setNoCredentials(true);
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      const siteAuthHeader = getAuthHeader();
      const userAuthHeader = getWpAuthHeader();
      const authValue = siteAuthHeader || (userAuthHeader ? userAuthHeader : null);

      const api = createWordPressApi(
        getApiBase(),
        authValue ? { Authorization: authValue } : {}
      );

      const data = await api.getUsers(undefined, authValue ? { Authorization: authValue } : undefined);
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      // 401/403 means wrong credentials for this site
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('Unauthorized')) {
        setNoCredentials(true);
        setUsers([]);
      } else {
        toast({
          title: 'Error',
          description: `Failed to fetch users from ${currentSite?.name || 'WordPress'}`,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Build site-aware WP Admin URL
  const wpAdminUserUrl = currentSite
    ? `${currentSite.url.replace(/\/$/, '')}/wp-admin/user-new.php`
    : 'https://digitmarketus.com/Bhairavi/wp-admin/user-new.php';

  const getUserBadge = (roles: string[]) => {
    if (roles.includes('administrator')) return <Badge>Admin</Badge>;
    if (roles.includes('editor')) return <Badge variant="default" className="bg-purple-600">SEO Manager</Badge>;
    if (roles.includes('author')) return <Badge variant="secondary" className="bg-blue-600 text-white">Sales Manager</Badge>;
    if (roles.includes('contributor')) return <Badge variant="secondary">Sales Person</Badge>;
    if (roles.includes('seo_person')) return <Badge variant="outline" className="border-purple-600 text-purple-600">SEO Person</Badge>;
    return <Badge variant="outline">Client</Badge>;
  };

  if (!hasPermission('users', 'read')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          You do not have permission to access this page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            User management —{' '}
            <span className="font-medium text-foreground">{currentSite?.name || 'Selected Site'}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadUsers}
          disabled={loading}
          size="sm"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members & Clients</CardTitle>
          <CardDescription>
            Live user list from <strong>{currentSite?.name || 'WordPress'}</strong> — {currentSite?.url}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : noCredentials ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <KeyRound className="h-10 w-10 text-amber-400 opacity-80" />
              <p className="font-semibold text-base">No credentials for <span className="text-foreground">{currentSite?.name}</span></p>
              <p className="text-sm text-muted-foreground max-w-sm">
                This site needs its own WordPress username and application password to fetch users.
              </p>
              <Button
                size="sm"
                className="mt-1"
                onClick={() => navigate('/sites')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure {currentSite?.name} Credentials
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {user.avatar_urls && (
                              <img
                                src={user.avatar_urls['48']}
                                alt={user.name}
                                className="h-8 w-8 rounded-full"
                              />
                            )}
                            {user.name}
                          </div>
                        </TableCell>
                        <TableCell>{getUserBadge(user.roles || [])}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {user.slug}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Role Mapping Guide</CardTitle>
            <CardDescription>How WordPress roles translate to App permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-3 text-left font-medium">WordPress Role</th>
                    <th className="p-3 text-left font-medium">App Access Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium text-xs">Administrator</td>
                    <td className="p-3"><Badge>Admin</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium text-xs">Editor</td>
                    <td className="p-3"><Badge variant="default" className="bg-purple-600">SEO Manager</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium text-xs">Author</td>
                    <td className="p-3"><Badge variant="secondary" className="bg-blue-600 text-white">Sales Manager</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium text-xs">Contributor</td>
                    <td className="p-3"><Badge variant="secondary">Sales Person</Badge></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium text-xs">Custom: 'seo_person'</td>
                    <td className="p-3"><Badge variant="outline" className="border-purple-600 text-purple-600">SEO Person</Badge></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-xs">Subscriber</td>
                    <td className="p-3"><Badge variant="outline">Client</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Create users in WordPress Dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To add a new team member or client:
              </p>
              <ol className="list-decimal list-inside text-sm space-y-2 ml-2">
                <li>Open <strong>WordPress Admin</strong>.</li>
                <li>Go to <strong>Users {'>'} Add New</strong>.</li>
                <li>Select role from the mapping table.</li>
                <li>User can login with their credentials.</li>
              </ol>

              <div className="pt-4">
                <Button asChild className="w-full">
                  <a
                    href={wpAdminUserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    WP Admin Dashboard
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

