import { useEffect, useState } from 'react';
import { rolePermissionsApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
type UserRole = 'admin' | 'sales' | 'seo' | 'client';

type RolePermission = {
  id: string;
  role: UserRole;
  feature: string;
  can_read: boolean;
  can_write: boolean;
  created_at: string;
  updated_at: string;
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      loadPermissions();
    }
  }, [isAdmin]);

  const loadPermissions = async () => {
    try {
      const data = await rolePermissionsApi.getAll();
      setPermissions(data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load permissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermission = async (
    permissionId: string,
    field: 'can_read' | 'can_write',
    value: boolean
  ) => {
    if (!isAdmin) return;

    try {
      await rolePermissionsApi.update(permissionId, { [field]: value });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'update_permission',
          resource_type: 'role_permission',
          resource_id: permissionId,
          details: { field, value },
        });
      }

      toast({
        title: 'Success',
        description: 'Permission updated successfully',
      });

      loadPermissions();
    } catch (error) {
      console.error('Failed to update permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to update permission',
        variant: 'destructive',
      });
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.role]) {
      acc[perm.role] = [];
    }
    acc[perm.role].push(perm);
    return acc;
  }, {} as Record<UserRole, RolePermission[]>);

  const getRoleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: 'bg-primary text-primary-foreground',
      sales: 'bg-secondary text-secondary-foreground',
      seo: 'bg-info text-white',
      client: 'bg-muted text-muted-foreground',
    };

    return (
      <Badge className={colors[role]}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You do not have permission to access this page</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24 bg-muted" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Role Permissions</h1>
        <p className="text-muted-foreground">Configure read and write permissions for each role</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(groupedPermissions).map(([role, perms]) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getRoleBadge(role as UserRole)}
                <span>Permissions</span>
              </CardTitle>
              <CardDescription>
                {role === 'admin' && 'Full access to all features'}
                {role === 'sales' && 'Access to leads and sales features'}
                {role === 'seo' && 'Access to SEO and lead features'}
                {role === 'client' && 'Limited read-only access'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {perms.map((perm) => (
                <div key={perm.id} className="space-y-3 p-4 border border-border rounded-lg">
                  <div className="font-medium text-sm">
                    {perm.feature.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${perm.id}-read`} className="text-sm">
                      Read Access
                    </Label>
                    <Switch
                      id={`${perm.id}-read`}
                      checked={perm.can_read}
                      onCheckedChange={(checked) =>
                        handleUpdatePermission(perm.id, 'can_read', checked)
                      }
                      disabled={role === 'admin'}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${perm.id}-write`} className="text-sm">
                      Write Access
                    </Label>
                    <Switch
                      id={`${perm.id}-write`}
                      checked={perm.can_write}
                      onCheckedChange={(checked) =>
                        handleUpdatePermission(perm.id, 'can_write', checked)
                      }
                      disabled={role === 'admin'}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Admin role has full access to all features and cannot be modified</p>
          <p>• Read access allows viewing data but not making changes</p>
          <p>• Write access includes both read and write capabilities</p>
          <p>• Changes take effect immediately for all users with that role</p>
        </CardContent>
      </Card>
    </div>
  );
}
