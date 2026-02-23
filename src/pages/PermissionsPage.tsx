import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { superAdminApi } from '@/services/superAdminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Save, Shield, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PermissionEntry = {
  can_read: boolean;
  can_write: boolean;
};

type RolePermissions = Record<string, PermissionEntry>;
type PermissionState = Record<string, RolePermissions>;

const CONFIGURABLE_ROLES = [
  { key: 'admin', label: 'Admin', color: 'bg-blue-600' },
  { key: 'lead_manager', label: 'Lead Manager', color: 'bg-orange-600' },
  { key: 'seo_manager', label: 'SEO Manager', color: 'bg-purple-600' },
  { key: 'sales_person', label: 'Sales Person', color: 'bg-green-600' },
  { key: 'seo_person', label: 'SEO Person', color: 'bg-indigo-600' },
  { key: 'client', label: 'Client', color: 'bg-gray-600' },
];

const FEATURES = [
  { key: 'leads', label: 'Leads' },
  { key: 'users', label: 'User Management' },
  { key: 'activity_logs', label: 'Activity Logs' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'seo_meta_tags', label: 'SEO Meta Tags' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'sites', label: 'Sites' },
  { key: 'ip_security', label: 'IP Security' },
  { key: 'permissions', label: 'Permissions' },
];

export default function PermissionsPage() {
  const { isSuperAdmin, superAdminToken, refreshPermissions } = useAuth();
  const { toast } = useToast();
  const [permState, setPermState] = useState<PermissionState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const rows = await superAdminApi.getPermissions();
      const state: PermissionState = {};

      for (const role of CONFIGURABLE_ROLES) {
        state[role.key] = {};
        for (const feature of FEATURES) {
          const row = rows.find(r => r.role === role.key && r.feature === feature.key);
          state[role.key][feature.key] = {
            can_read: row ? !!row.can_read : false,
            can_write: row ? !!row.can_write : false,
          };
        }
      }

      setPermState(state);
      setHasChanges(false);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load permissions. Is the server running?',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (role: string, feature: string, type: 'can_read' | 'can_write') => {
    setPermState(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [feature]: {
          ...prev[role][feature],
          [type]: !prev[role][feature][type],
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!superAdminToken) return;
    setSaving(true);

    try {
      const permissions: Array<{ role: string; feature: string; can_read: boolean; can_write: boolean }> = [];

      for (const role of CONFIGURABLE_ROLES) {
        for (const feature of FEATURES) {
          const perm = permState[role.key]?.[feature.key];
          if (perm) {
            permissions.push({
              role: role.key,
              feature: feature.key,
              can_read: perm.can_read,
              can_write: perm.can_write,
            });
          }
        }
      }

      await superAdminApi.bulkUpdatePermissions(superAdminToken, permissions);
      await refreshPermissions();

      setHasChanges(false);
      toast({
        title: 'Permissions Saved',
        description: `Updated ${permissions.length} permission entries.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save permissions.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg font-medium">
          Super Admin access required
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Only the Super Admin can manage role permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Permissions</h1>
          <p className="text-muted-foreground">
            Configure read/write access per feature for each role
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPermissions}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-[#dc2626] hover:bg-[#b91c1c]"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Permissions
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
          You have unsaved changes. Click "Save Permissions" to apply.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#dc2626]" />
            Permission Matrix
          </CardTitle>
          <CardDescription>
            Super Admin always has full access. Configure permissions for other roles below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue={CONFIGURABLE_ROLES[0].key}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {CONFIGURABLE_ROLES.map(role => (
                  <TabsTrigger key={role.key} value={role.key} className="text-xs">
                    {role.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CONFIGURABLE_ROLES.map(role => (
                <TabsContent key={role.key} value={role.key}>
                  <div className="mb-3">
                    <Badge className={`${role.color} text-white`}>{role.label}</Badge>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[250px]">Feature</TableHead>
                          <TableHead className="w-[120px] text-center">Read</TableHead>
                          <TableHead className="w-[120px] text-center">Write</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {FEATURES.map(feature => {
                          const perm = permState[role.key]?.[feature.key];
                          return (
                            <TableRow key={feature.key}>
                              <TableCell className="font-medium">{feature.label}</TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={perm?.can_read ?? false}
                                  onCheckedChange={() => togglePermission(role.key, feature.key, 'can_read')}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={perm?.can_write ?? false}
                                  onCheckedChange={() => togglePermission(role.key, feature.key, 'can_write')}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
