import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { profilesApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Mail, Phone, Calendar, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: currentUser, hasPermission } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    role: 'sales' as UserRole,
    is_client_paid: false,
  });

  useEffect(() => {
    if (id) {
      loadUser();
    }
  }, [id]);

  const loadUser = async () => {
    if (!id) return;

    try {
      const userData = await profilesApi.getById(id);
      if (!userData) {
        setLoading(false);
        return;
      }
      setUser(userData as Profile);
      setFormData({
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'sales',
        is_client_paid: userData.is_client_paid || false,
      });
    } catch (error) {
      console.error('Failed to load user:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;

    const isOwnProfile = id === currentUser?.id;
    const canEdit = isOwnProfile || hasPermission('users', 'write');

    if (!canEdit) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to edit this profile',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updates: Record<string, unknown> = {
        username: formData.username,
        email: formData.email || null,
        phone: formData.phone || null,
      };

      // Only admins can change roles
      if (hasPermission('users', 'write') && !isOwnProfile) {
        updates.role = formData.role;
        updates.is_client_paid = formData.is_client_paid;
      }

      await profilesApi.update(id, updates);

      if (currentUser) {
        await activityLogsApi.create({
          user_id: currentUser.id as string,
          action: 'update_profile',
          resource_type: 'user',
          resource_id: id,
          details: { username: formData.username },
        });
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setEditing(false);
      loadUser();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
          <p className="text-muted-foreground mb-4">The user you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/users')}>Back to Users</Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = id === currentUser?.id;
  const canEdit = isOwnProfile || hasPermission('users', 'write');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        {canEdit && !editing && (
          <Button onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setEditing(false);
              setFormData({
                username: user.username,
                email: user.email || '',
                phone: user.phone || '',
                role: user.role,
                is_client_paid: user.is_client_paid,
              });
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{user.username}</CardTitle>
            <Badge className={
              user.role === 'admin' ? 'bg-red-500 text-white' :
              user.role === 'sales' ? 'bg-blue-500 text-white' :
              user.role === 'seo' ? 'bg-green-500 text-white' :
              'bg-purple-500 text-white'
            }>
              {user.role}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              {editing ? (
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span>{user.username}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {editing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user.email || 'N/A'}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              {editing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone || 'N/A'}</span>
                </div>
              )}
            </div>

            {editing && hasPermission('users', 'write') && !isOwnProfile && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="seo">SEO</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === 'client' && (
                  <div className="space-y-2">
                    <Label>Client Status</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_client_paid"
                        checked={formData.is_client_paid}
                        onChange={(e) => setFormData({ ...formData, is_client_paid: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="is_client_paid">Has paid subscription</Label>
                    </div>
                  </div>
                )}
              </>
            )}

            {!editing && user.role === 'client' && (
              <div className="space-y-2">
                <Label>Subscription Status</Label>
                <div>
                  {user.is_client_paid ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(user.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
