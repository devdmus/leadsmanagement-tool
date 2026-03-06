import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, User, Globe, Info } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  timestamp?: string;
  created_at?: string;
}

export default function ActivityDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const log = location.state?.log as ActivityLog;

  if (!log) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Activity log not found</p>
      </div>
    );
  }

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

  const timestamp = log.timestamp || log.created_at;
  const formattedDate = timestamp && !isNaN(new Date(timestamp).getTime())
    ? format(new Date(timestamp), 'MMM d, yyyy HH:mm:ss')
    : 'Invalid Date';

  return (
    <div className="space-y-6 p-0 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Activity Details</h1>
          <p className="text-muted-foreground">View full activity log information</p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Activity Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timestamp */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                Timestamp
              </label>
              <p className="text-base">{formattedDate}</p>
            </div>

            {/* User */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <User className="h-4 w-4" />
                User
              </label>
              <p className="text-base font-medium">{log.username}</p>
            </div>

            {/* Action */}
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                Action
              </label>
              <div>{getActionBadge(log.action)}</div>
            </div>

            {/* IP Address */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <Globe className="h-4 w-4" />
                IP Address
              </label>
              <p className="text-base font-mono">{log.ip_address}</p>
            </div>

            {/* Details */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <Info className="h-4 w-4" />
                Details
              </label>
              <div className="bg-muted p-4 rounded-md border">
                <p className="text-base whitespace-pre-wrap break-words">{log.details}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
