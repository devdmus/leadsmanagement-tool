import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Clock, User, Globe, Info } from 'lucide-react';
import { wordpressApi } from '@/db/wordpressApi';
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
  const { hasPermission, getWpAuthHeader } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const authHeader = getWpAuthHeader();
      const data = await wordpressApi.getActivityLogs(page, authHeader ? { Authorization: authHeader } : undefined);
      setLogs(data);
    } catch (err: any) {
      console.error('Detailed Activity Load Error:', {
        message: err.message,
        error: err,
        url: `https://digitmarketus.com/Bhairavi/wp-json/crm/v1/logs?page=${page}`
      });
      toast({
        title: 'Fetch Error',
        description: err.message || 'Failed to fetch activity logs. Check browser console for details.',
        variant: 'destructive',
      });
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
            Monitor system actions and security events from server
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
            Audit trail of all administrative and security actions stored in WordPress
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
