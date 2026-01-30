import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profilesApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { notificationHelper } from '@/lib/notificationHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, Phone, Calendar, Save, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/db/supabase';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_client_paid: boolean;
  subscription_plan: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  updated_at: string;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile: currentUser } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    if (!currentUser?.id) return;

    try {
      const userData = await profilesApi.getById(currentUser.id as string);
      if (!userData) {
        setLoading(false);
        return;
      }
      setUser(userData as Profile);
      setFormData({
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;

    // Validate password change if requested
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        toast({
          title: 'Error',
          description: 'Please enter your current password',
          variant: 'destructive',
        });
        return;
      }

      if (formData.newPassword.length < 6) {
        toast({
          title: 'Error',
          description: 'New password must be at least 6 characters',
          variant: 'destructive',
        });
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        toast({
          title: 'Error',
          description: 'New passwords do not match',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);

    try {
      // Update profile information
      await profilesApi.update(currentUser.id as string, {
        username: formData.username,
        email: formData.email || null,
        phone: formData.phone || null,
      });

      // Update password if requested
      if (formData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (passwordError) throw passwordError;

        toast({
          title: 'Success',
          description: 'Profile and password updated successfully',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        });
      }

      await activityLogsApi.create({
        user_id: currentUser.id as string,
        action: 'update_profile',
        resource_type: 'user',
        resource_id: currentUser.id as string,
        details: { username: formData.username },
      });

      await notificationHelper.notifyUser(
        currentUser.id as string,
        'Profile Updated',
        'Your profile has been updated successfully.',
        'success',
        'profile_updated'
      );

      setEditing(false);
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      loadProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
          <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">Unable to load your profile.</p>
          <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        {!editing && (
          <Button onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setFormData({
                  username: user.username,
                  email: user.email || '',
                  phone: user.phone || '',
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">{user.username}</CardTitle>
              <Badge
                className={
                  user.role === 'admin'
                    ? 'bg-red-500 text-white'
                    : user.role === 'sales'
                    ? 'bg-blue-500 text-white'
                    : user.role === 'seo'
                    ? 'bg-green-500 text-white'
                    : 'bg-purple-500 text-white'
                }
              >
                {user.role}
              </Badge>
            </div>
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
                <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
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
                <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
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
                <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone || 'N/A'}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                <span>{user.role}</span>
              </div>
            </div>

            {user.role === 'client' && (
              <>
                <div className="space-y-2">
                  <Label>Subscription Status</Label>
                  <div className="flex items-center gap-2">
                    {user.is_client_paid ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {user.subscription_plan && (
                      <span className="text-sm text-muted-foreground">
                        {user.subscription_plan}
                      </span>
                    )}
                  </div>
                </div>

                {user.subscription_end && (
                  <div className="space-y-2">
                    <Label>Subscription Expires</Label>
                    <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(user.subscription_end).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(user.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {editing && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold">Change Password</h3>
              <p className="text-sm text-muted-foreground">
                Leave blank if you don't want to change your password
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
