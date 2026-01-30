import { useEffect, useState } from 'react';
import { profilesApi, activityLogsApi } from '@/db/api';
import { paginationHelper, type PaginationParams } from '@/db/helpers';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/common/DataPagination';
import { Plus, Edit, Trash2, Search, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    role: 'sales' as UserRole,
    is_client_paid: false,
  });

  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, [currentPage, pageSize, searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      const filters: Record<string, unknown> = {};
      if (roleFilter !== 'all') filters.role = roleFilter;

      const params: PaginationParams = {
        page: currentPage,
        pageSize,
        search: searchQuery,
        filters,
      };

      const result = await paginationHelper.paginate<Profile>(
        'profiles',
        params,
        '*',
        ['username', 'email']
      );

      setUsers(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    if (!hasPermission('users', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to manage users',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.username.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Username is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        await profilesApi.update(editingUser.id, {
          username: formData.username,
          email: formData.email || null,
          phone: formData.phone || null,
          role: formData.role,
          is_client_paid: formData.is_client_paid,
        });

        if (profile) {
          await activityLogsApi.create({
            user_id: profile.id as string,
            action: 'update_user',
            resource_type: 'user',
            resource_id: editingUser.id,
            details: { username: formData.username, role: formData.role },
          });
        }

        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
      } else {
        // Note: Creating new users requires them to register first
        toast({
          title: 'Info',
          description: 'Users must register through the signup page. You can then update their role here.',
          variant: 'default',
        });
        setShowDialog(false);
        return;
      }

      setShowDialog(false);
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        phone: '',
        role: 'sales',
        is_client_paid: false,
      });
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      toast({
        title: 'Error',
        description: 'Failed to save user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!hasPermission('users', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to delete users',
        variant: 'destructive',
      });
      return;
    }

    try {
      await profilesApi.delete(userId);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_user',
          resource_type: 'user',
          resource_id: userId,
          details: { username },
        });
      }

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      is_client_paid: user.is_client_paid,
    });
    setShowDialog(true);
  };

  const openNewDialog = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      phone: '',
      role: 'sales',
      is_client_paid: false,
    });
    setShowDialog(true);
  };

  const getRoleBadge = (role: UserRole) => {
    const variants = {
      admin: 'bg-red-500 text-white',
      sales: 'bg-blue-500 text-white',
      seo: 'bg-green-500 text-white',
      client: 'bg-purple-500 text-white',
    };
    return <Badge className={variants[role]}>{role}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        {hasPermission('users', 'write') && (
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="seo">SEO</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden xl:table-cell">Client Paid</TableHead>
                      <TableHead className="hidden xl:table-cell">Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell className="hidden md:table-cell">{user.email || '-'}</TableCell>
                          <TableCell className="hidden lg:table-cell">{user.phone || '-'}</TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {user.is_client_paid ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/users/${user.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission('users', 'write') && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(user)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {user.id !== profile?.id && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete {user.username} and all associated data.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteUser(user.id, user.username)}
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalItems / pageSize)}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user information and role'
                : 'Users must register first. You can update their role after registration.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="johndoe"
                disabled={!editingUser}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1-555-0123"
              />
            </div>
            <div>
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
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_client_paid"
                  checked={formData.is_client_paid}
                  onChange={(e) => setFormData({ ...formData, is_client_paid: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_client_paid">Client has paid subscription</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Update' : 'Add'} User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
