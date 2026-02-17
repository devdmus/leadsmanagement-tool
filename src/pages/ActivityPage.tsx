import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { activityLogsApi, profilesApi } from '@/db/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type ActivityLog = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  user?: { username: string };
};

export default function ActivityPage() {
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [logsData, profilesData] = await Promise.all([
          activityLogsApi.getAll(),
          profilesApi.getAll()
        ]);

        // Map user details to logs
        const mappedLogs = logsData.map((log: any) => ({
          ...log,
          user: profilesData.find((p: any) => p.id === log.user_id)
        }));

        setLogs(mappedLogs);
      } catch (error) {
        console.error('Failed to load activity logs:', error);
      } finally {
        setLoading(false);
      }
    };

    if (hasPermission('activity_logs', 'read')) {
      loadData();
    }
  }, [hasPermission]);

  if (!hasPermission('activity_logs', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          You do not have permission to access this page
        </p>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    const map: Record<string, string> = {
      create_lead: 'bg-green-500',
      update_lead: 'bg-blue-500',
      delete_lead: 'bg-red-500',
      lead_assigned: 'bg-indigo-500',
      status_change: 'bg-yellow-500',
      create_note: 'bg-emerald-500',
      update_note: 'bg-teal-500',
      delete_note: 'bg-orange-500',
      create_follow_up: 'bg-purple-500',
      update_follow_up: 'bg-pink-500',
      delete_follow_up: 'bg-rose-500',
      create_seo_tag: 'bg-violet-500',
      update_seo_tag: 'bg-fuchsia-500',
      delete_seo_tag: 'bg-rose-500',
      bulk_delete_seo_tags: 'bg-red-600',
      bulk_assign_seo_tags: 'bg-indigo-600',
    };

    // Fallback or default styling
    const colorClass = map[action] || 'bg-slate-500';

    return (
      <Badge className={`${colorClass} text-white hover:${colorClass}`}>
        {action.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const renderDetails = (details: Record<string, any> | null) => {
    if (!details) return '-';
    return (
      <div className="text-xs text-muted-foreground max-w-[300px] truncate">
        {Object.entries(details).map(([key, value]) => (
          <span key={key} className="mr-2">
            <span className="font-semibold">{key}:</span> {String(value)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground">
          System activity tracking
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {log.created_at ? format(new Date(log.created_at), 'MMM d, h:mm a') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.user?.username || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell>
                      {renderDetails(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
