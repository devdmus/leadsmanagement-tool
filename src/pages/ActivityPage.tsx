import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { superAdminApi } from '@/services/superAdminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Clock, User, Globe, Info, KeyRound, Settings, ShieldCheck } from 'lucide-react';
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
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ServerLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

interface SuperAdminLog {
  id: number;
  admin_id: number;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function ActivityPage() {
  const { hasPermission, isSuperAdmin, getWpAuthHeader, superAdminToken } = useAuth();
  const { currentSite, getApiBase, getAuthHeader } = useSite();
  const { toast } = useToast();
  const navigate = useNavigate();

  // WP site logs
  const [siteLogs, setSiteLogs] = useState<ServerLog[]>([]);
  const [siteLoading, setSiteLoading] = useState(true);
  const [noCredentials, setNoCredentials] = useState(false);
  const [sitePage, setSitePage] = useState(1);

  // Super admin logs
  const [saLogs, setSaLogs] = useState<SuperAdminLog[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [saPage, setSaPage] = useState(1);
  const [saTotal, setSaTotal] = useState(0);

  useEffect(() => {
    loadSiteLogs();
  }, [sitePage, currentSite?.id]);

  useEffect(() => {
    if (isSuperAdmin && superAdminToken) {
      loadSaLogs();
    }
  }, [saPage, isSuperAdmin, superAdminToken]);

  const loadSiteLogs = async () => {
    setSiteLoading(true);
    setNoCredentials(false);

    if (currentSite && !currentSite.isDefault && !currentSite.username && !isSuperAdmin) {
      setNoCredentials(true);
      setSiteLogs([]);
      setSiteLoading(false);
      return;
    }

    try {
      const siteAuthHeader = getAuthHeader();
      const userAuthHeader = getWpAuthHeader(currentSite?.id);
      const authValue = siteAuthHeader || (userAuthHeader ? userAuthHeader : null);

      const api = createWordPressApi(
        getApiBase(),
        authValue ? { Authorization: authValue } : {}
      );

      const data = await api.getActivityLogs(sitePage, authValue ? { Authorization: authValue } : undefined);
      setSiteLogs(data);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('permission')) {
        setNoCredentials(true);
        setSiteLogs([]);
      } else {
        toast({
          title: 'Fetch Error',
          description: err.message || 'Failed to fetch activity logs.',
          variant: 'destructive',
        });
      }
    } finally {
      setSiteLoading(false);
    }
  };

  const loadSaLogs = async () => {
    if (!superAdminToken) return;
    setSaLoading(true);
    try {
      const result = await superAdminApi.getActivityLogs(superAdminToken, saPage);
      setSaLogs(result.logs);
      setSaTotal(result.total);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch super admin logs.',
        variant: 'destructive',
      });
    } finally {
      setSaLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <Badge className="bg-green-600">Login</Badge>;
      case 'logout':
        return <Badge variant="outline">Logout</Badge>;
      case 'ip_blocked':
        return <Badge variant="destructive">IP Blocked</Badge>;
      case 'ip_whitelist':
        return <Badge className="bg-blue-600">IP Whitelist</Badge>;
      case 'create_lead':
        return <Badge className="bg-emerald-600">Create Lead</Badge>;
      case 'update_lead':
        return <Badge className="bg-sky-600">Update Lead</Badge>;
      default:
        return <Badge variant="secondary">{action.replace(/_/g, ' ')}</Badge>;
    }
  };

  const LogTable = ({
    logs,
    loading,
    timestampKey,
    emptyLabel,
  }: {
    logs: Array<any>;
    loading: boolean;
    timestampKey: string;
    emptyLabel: string;
  }) => (
    loading ? (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {log[timestampKey] && !isNaN(new Date(log[timestampKey]).getTime())
                        ? format(new Date(log[timestampKey]), 'MMM d, yyyy HH:mm:ss')
                        : 'Invalid Date'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{log.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex items-start gap-2">
                      <Info className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                      <span className="text-sm">{log.details}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {log.ip_address}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    )
  );

  if (!hasPermission('activity_logs', 'read')) {
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
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground">Audit trail for all system actions</p>
      </div>

      <Tabs defaultValue={isSuperAdmin ? 'super_admin' : 'site'}>
        <TabsList>
          {isSuperAdmin && (
            <TabsTrigger value="super_admin" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Super Admin Logs
            </TabsTrigger>
          )}
          <TabsTrigger value="site" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Site Logs — {currentSite?.name || 'Current Site'}
          </TabsTrigger>
        </TabsList>

        {/* ── Super Admin Logs Tab ─────────────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="super_admin">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Super Admin Activity</CardTitle>
                    <CardDescription>
                      Login, logout, and all actions performed by the Super Admin account — stored in the CRM database.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm"
                      onClick={() => setSaPage(p => Math.max(1, p - 1))}
                      disabled={saLoading || saPage === 1}>
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-1">Page {saPage}</span>
                    <Button variant="outline" size="sm"
                      onClick={() => setSaPage(p => p + 1)}
                      disabled={saLoading || saLogs.length < 50}>
                      Next
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadSaLogs} disabled={saLoading}>
                      {saLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {saTotal > 0 && (
                  <p className="text-xs text-muted-foreground pt-1">{saTotal} total entries</p>
                )}
              </CardHeader>
              <CardContent>
                <LogTable
                  logs={saLogs}
                  loading={saLoading}
                  timestampKey="created_at"
                  emptyLabel="No super admin activity logged yet"
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Site / WP Logs Tab ───────────────────────────────── */}
        <TabsContent value="site">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Site Activity</CardTitle>
                  <CardDescription>
                    Audit trail for <strong>{currentSite?.name || 'selected site'}</strong> — {currentSite?.url}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm"
                    onClick={() => setSitePage(p => Math.max(1, p - 1))}
                    disabled={siteLoading || sitePage === 1}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-1">Page {sitePage}</span>
                  <Button variant="outline" size="sm"
                    onClick={() => setSitePage(p => p + 1)}
                    disabled={siteLoading || siteLogs.length < 50}>
                    Next
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadSiteLogs} disabled={siteLoading}>
                    {siteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {noCredentials ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <KeyRound className="h-10 w-10 text-amber-400 opacity-80" />
                  <p className="font-semibold text-base">No credentials for <span className="text-foreground">{currentSite?.name}</span></p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    This site needs its own WordPress username and application password to fetch activity logs.
                  </p>
                  <Button size="sm" className="mt-1" onClick={() => navigate('/sites')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure {currentSite?.name} Credentials
                  </Button>
                </div>
              ) : (
                <LogTable
                  logs={siteLogs}
                  loading={siteLoading}
                  timestampKey="timestamp"
                  emptyLabel="No logs found on this site"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
