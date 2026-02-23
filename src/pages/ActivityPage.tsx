import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Clock, User, Globe, Info, KeyRound, Settings } from 'lucide-react';
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

export default function ActivityPage() {
  const { hasPermission, isSuperAdmin, getWpAuthHeader } = useAuth();
  const { currentSite, getApiBase, getAuthHeader } = useSite();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noCredentials, setNoCredentials] = useState(false);
  const [page, setPage] = useState(1);

  // Re-fetch whenever the selected site or page changes
  useEffect(() => {
    loadLogs();
  }, [page, currentSite?.id]);

  const loadLogs = async () => {
    setLoading(true);
    setNoCredentials(false);

    // If the current site has no dedicated credentials, skip the fetch gracefully
    // EXCEPT for Super Admins, who may have fallback credentials or full access.
    if (currentSite && !currentSite.isDefault && !currentSite.username && !isSuperAdmin) {
      setNoCredentials(true);
      setLogs([]);
      setLoading(false);
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

      const data = await api.getActivityLogs(page, authValue ? { Authorization: authValue } : undefined);
      setLogs(data);
    } catch (err: any) {
      console.error('Detailed Activity Load Error:', {
        message: err.message,
        error: err,
        site: currentSite?.name,
        apiBase: getApiBase(),
      });
      // 401/403 means credentials are wrong for this site — show friendly message
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('permission')) {
        setNoCredentials(true);
        setLogs([]);
      } else {
        toast({
          title: 'Fetch Error',
          description: err.message || 'Failed to fetch activity logs.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">
            Monitor system actions and security events from{' '}
            <span className="font-medium text-foreground">{currentSite?.name || 'server'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page === 1}
            size="sm"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || logs.length < 50}
            size="sm"
          >
            Next
          </Button>
          <Button
            variant="outline"
            onClick={loadLogs}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Activity</CardTitle>
          <CardDescription>
            Audit trail for <strong>{currentSite?.name || 'selected site'}</strong> — {currentSite?.url}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
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
                This site needs its own WordPress username and application password to fetch activity logs.
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
                        No logs found in server
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                              ? format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
