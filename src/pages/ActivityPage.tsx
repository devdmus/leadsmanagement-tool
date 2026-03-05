import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { superAdminApi } from '@/services/superAdminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, User, Globe, Info, KeyRound, Settings, ShieldCheck } from 'lucide-react';
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
import { DataPagination } from '@/components/common/DataPagination';
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
  const [allSiteLogs, setAllSiteLogs] = useState<ServerLog[]>([]); // full dataset
  const [siteLoading, setSiteLoading] = useState(true);
  const [noCredentials, setNoCredentials] = useState(false);
  const [sitePage, setSitePage] = useState(1);
  const [sitePageSize, setSitePageSize] = useState(10);

  // Derived: slice allSiteLogs to current page
  const siteLogs = allSiteLogs.slice((sitePage - 1) * sitePageSize, sitePage * sitePageSize);
  const siteTotalItems = allSiteLogs.length;

  // Super admin logs
  const [saLogs, setSaLogs] = useState<SuperAdminLog[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [saPage, setSaPage] = useState(1);
  const [saPageSize, setSaPageSize] = useState(10);
  const [saTotalItems, setSaTotalItems] = useState(0);

  // Check permissions early
  if (!hasPermission('activity_logs', 'read')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          You do not have permission to access this page
        </p>
      </div>
    );
  }

  // Reset site page when site changes
  useEffect(() => {
    setSitePage(1);
  }, [currentSite?.id]);

  const loadSiteLogs = useCallback(async () => {
    setSiteLoading(true);
    setNoCredentials(false);
    console.log('📋 ActivityPage - loadSiteLogs called (fetching all):', { currentSite: currentSite?.name });

    if (currentSite && !currentSite.isDefault && !currentSite.username && !isSuperAdmin) {
      setNoCredentials(true);
      setAllSiteLogs([]);
      setSiteLoading(false);
      return;
    }

    try {
      const siteAuthHeader = getAuthHeader();
      const userAuthHeader = getWpAuthHeader(currentSite?.id);
      const authValue = siteAuthHeader || (userAuthHeader ? userAuthHeader : null);

      const apiBase = getApiBase();
      const api = createWordPressApi(apiBase, authValue ? { Authorization: authValue } : {});

      // Fetch all records at once (limit=500) — pagination is done client-side
      const data = await api.getActivityLogs(1, 500, authValue ? { Authorization: authValue } : undefined);

      const logsArray: ServerLog[] = Array.isArray(data.logs)
        ? data.logs
        : (Array.isArray(data) ? (data as any[]) : []);

      console.log('📋 ActivityPage - fetched', logsArray.length, 'site log records');
      setAllSiteLogs(logsArray);
      setSitePage(1); // reset to first page whenever data reloads
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('permission')) {
        setNoCredentials(true);
        setAllSiteLogs([]);
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
  }, [currentSite, isSuperAdmin, getAuthHeader, getWpAuthHeader, getApiBase, toast]);

  const loadSaLogs = useCallback(async () => {
    if (!superAdminToken) return;
    setSaLoading(true);
    try {
      const result = await superAdminApi.getActivityLogs(superAdminToken, saPage, saPageSize);
      setSaLogs(result.logs);
      setSaTotalItems(result.total);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch super admin logs.',
        variant: 'destructive',
      });
    } finally {
      setSaLoading(false);
    }
  }, [superAdminToken, saPage, saPageSize, toast]);

  // Reload all logs only when site changes (pagination is client-side)
  useEffect(() => {
    if (currentSite?.id) {
      loadSiteLogs();
    }
  }, [currentSite?.id, loadSiteLogs]);

  useEffect(() => {
    if (isSuperAdmin && superAdminToken) {
      loadSaLogs();
    }
  }, [saPage, saPageSize, isSuperAdmin, superAdminToken, loadSaLogs]);

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
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px] h-12">Timestamp</TableHead>
              <TableHead className="h-12">User</TableHead>
              <TableHead className="h-12">Action</TableHead>
              <TableHead className="h-12">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors h-14"
                  onClick={() => navigate(`/activity/${log.id}`, { state: { log } })}
                >
                  <TableCell className="text-muted-foreground text-xs py-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 shrink-0" />
                      {log[timestampKey] && !isNaN(new Date(log[timestampKey]).getTime())
                        ? format(new Date(log[timestampKey]), 'MMM d, yyyy HH:mm:ss')
                        : 'Invalid Date'}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{log.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">{getActionBadge(log.action)}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs py-3">
                    <div className="flex items-center gap-1">
                      <Globe className="h-4 w-4 shrink-0" />
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

  return (
    <div className="space-y-6 p-0 animate-fade-in">
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
                <div>
                  <CardTitle>Super Admin Activity</CardTitle>
                  <CardDescription>
                    Login, logout, and all actions performed by the Super Admin account — stored in the CRM database.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <LogTable
                  logs={saLogs}
                  loading={saLoading}
                  timestampKey="created_at"
                  emptyLabel="No super admin activity logged yet"
                />
                <DataPagination
                  currentPage={saPage}
                  totalPages={Math.ceil(saTotalItems / saPageSize)}
                  pageSize={saPageSize}
                  totalItems={saTotalItems}
                  onPageChange={setSaPage}
                  onPageSizeChange={(size) => {
                    setSaPageSize(size);
                    setSaPage(1);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Site / WP Logs Tab ───────────────────────────────── */}
        <TabsContent value="site">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Site Activity</CardTitle>
                <CardDescription>
                  Audit trail for <strong>{currentSite?.name || 'selected site'}</strong> — {currentSite?.url}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <>
                  <LogTable
                    logs={siteLogs}
                    loading={siteLoading}
                    timestampKey="timestamp"
                    emptyLabel="No logs found on this site"
                  />
                  <DataPagination
                    currentPage={sitePage}
                    totalPages={Math.ceil(siteTotalItems / sitePageSize)}
                    pageSize={sitePageSize}
                    totalItems={siteTotalItems}
                    onPageChange={setSitePage}
                    onPageSizeChange={(size) => {
                      setSitePageSize(size);
                      setSitePage(1);
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
