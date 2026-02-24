import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { wpLeadsApi } from '@/db/wpLeadsApi';
import { followUpsApi } from '@/db/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, UserRoundCheck, TriangleAlert, BellRing, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSite } from '@/contexts/SiteContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { notificationHelper } from '@/lib/notificationHelper';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function DashboardPage() {
  const { currentSite } = useSite();
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    completed: number;
    remainder: number;
    bySource: Record<string, number>;
  } | null>(null);
  const [dueFollowUps, setDueFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadStats();
    loadFollowUps();
  }, [currentSite?.id]);

  const loadFollowUps = async () => {
    try {
      const due = await followUpsApi.getDue(currentSite?.id);
      setDueFollowUps(due);
    } catch (error) {
      console.error('Failed to load due follow-ups:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await wpLeadsApi.getAll();

      const stats = {
        total: data.length,
        pending: data.filter((l: any) => (l.status || '').toLowerCase() === 'pending').length,
        completed: data.filter((l: any) => (l.status || '').toLowerCase() === 'completed').length,
        remainder: data.filter((l: any) => (l.status || '').toLowerCase() === 'remainder').length,
        bySource: data.reduce((acc: Record<string, number>, l: any) => {
          let s = (l.source || 'form').toLowerCase();
          if (s.includes('form') || s.includes('website') || s === 'webisite') s = 'Form';
          else if (s === 'facebook') s = 'Facebook';
          else if (s === 'linkedin') s = 'LinkedIn';
          else if (s === 'seo') s = 'SEO';
          else s = s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {
          Facebook: 0,
          LinkedIn: 0,
          Form: 0,
          SEO: 0,
        } as Record<string, number>)
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sourceData = stats ? Object.entries(stats.bySource).map(([name, value]) => ({
    name,
    value
  })) : [];

  const statusData = stats ? [
    { name: 'Pending', value: stats.pending },
    { name: 'Completed', value: stats.completed },
    { name: 'Reminder', value: stats.remainder },
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your marketing leads</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-4 w-4 bg-muted" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your marketing leads</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            if (profile) {
              await notificationHelper.notifyUser(
                profile.id.toString(),
                'Test Notification',
                'This is a test notification to verify the bell icon alert.',
                'info',
                'test'
              );
              toast({ title: "Test Alert Sent", description: "Refresh or wait for the poll to see the bell icon update." });
            }
          }}
        >
          <BellRing className="h-4 w-4 mr-2" />
          Send Test Alert
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-8 w-8 text-muted-foreground text-[#ff0000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff0000]">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              All leads from all sources
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TriangleAlert className="h-8 w-8 text-[#f59e0b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats?.pending || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Awaiting follow-up
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <UserRoundCheck className="h-8 w-8 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats?.completed || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Successfully closed
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reminder</CardTitle>
            <BellRing className="h-8 w-8 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats?.remainder || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Needs attention
            </p>
          </CardContent>
        </Card>
      </div>

      {dueFollowUps.length > 0 && (
        <Card className="border-info/50 bg-info/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-info animate-bounce" />
              <CardTitle>Due For Follow-up</CardTitle>
            </div>
            <CardDescription>Scheduled tasks that need attention right now</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dueFollowUps.slice(0, 6).map((fu) => (
                <div key={fu.id} className="flex items-center justify-between p-3 border rounded-lg bg-background hover:border-info transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Lead ID: {fu.lead_id}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(fu.follow_up_date).toLocaleString()}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{fu.type}</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/leads/${fu.lead_id}`)}>
                    View
                  </Button>
                </div>
              ))}
            </div>
            {dueFollowUps.length > 6 && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                And {dueFollowUps.length - 6} more follow-ups due...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
            <CardDescription>Distribution of leads across different channels</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--foreground))" tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Leads by Status</CardTitle>
            <CardDescription>Current status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
