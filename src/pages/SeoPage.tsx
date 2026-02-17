import { useEffect, useState } from 'react';
import { seoMetaTagsApi, activityLogsApi, profilesApi, bulkOperations } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import type { SeoMetaTag, Profile } from '../types/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, MoreVertical, UserPlus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WPPostType = {
  slug: string
  name?: string
  rest_base?: string
  labels?: {
    name?: string
  }
}

type WPPost = {
  id: number
  title: {
    rendered: string
  }
}

export default function SeoPage() {
  const [tags, setTags] = useState<SeoMetaTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<SeoMetaTag | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isBulkAssignDialogOpen, setIsBulkAssignDialogOpen] = useState(false);
  const [bulkAssignUser, setBulkAssignUser] = useState<string>('unassigned');

  const { profile, hasPermission, getWpAuthHeader } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    page_identifier: '',
    title: '',
    keywords: '',
    description: '',
    assigned_to: 'unassigned', // Default value
  });

  useEffect(() => {
    if (profile) {
      loadTags();
    }
  }, [profile?.id]); // Reload when profile changes

  const loadTags = async () => {
    try {
      setLoading(true);
      const [data, usersData] = await Promise.all([
        seoMetaTagsApi.getAll(),
        profilesApi.getAll()
      ]);

      let filteredTags = data;
      // If SEO Person, only show assigned tags. Admin and SEO Manager see all.
      if (profile && profile.role === 'seo_person') {
        filteredTags = data.filter((tag: SeoMetaTag) => tag.assigned_to === profile.id);
      }

      setTags(filteredTags);
      setUsers(usersData as Profile[]);
    } catch (error) {
      console.error('Failed to load SEO tags:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SEO meta tags',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWpSeoFields = async () => {
    if (!formDatanew.post_id || !formDatanew.rest_base) return

    const authHeader = getWpAuthHeader();
    if (!authHeader) {
      toast({
        title: 'Authentication Required',
        description: 'Please login with your WordPress credentials to update SEO fields.',
        variant: 'destructive',
      });
      // Optional: redirect to login or open login modal
      return;
    }

    try {
      const response = await fetch(
        `https://digitmarketus.com/Bhairavi/wp-json/wp/v2/${formDatanew.rest_base}/${formDatanew.post_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({
            acf: {
              seo_title: formData.title,
              seo_description: formData.description,
              seo_keywords: formData.keywords,
            }
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WordPress SEO Update Error:", error);
        throw new Error(error.message || "Failed to update WordPress SEO fields");
      }

      const result = await response.json();
      console.log("WP SEO Update Success:", result);
      return result;
    } catch (error) {
      console.error("Failed to update WordPress SEO fields:", error);
      // Don't throw - allow the local DB update to succeed even if WP update fails
      toast({
        title: 'Warning',
        description: 'SEO data saved locally, but WordPress update failed. Check if ACF fields are configured.',
        variant: 'destructive',
      });
    }
  }

  const handleCreate = async () => {
    if (!hasPermission('seo_meta_tags', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to create SEO meta tags',
        variant: 'destructive',
      });
      return;
    }

    try {
      const selectedPost = posts.find(p => p.id.toString() === formDatanew.post_id);
      const postTitle = selectedPost?.title?.rendered || `${formDatanew.post_type}:${formDatanew.post_id}`;

      await seoMetaTagsApi.create({
        page_identifier: postTitle,
        title: formData.title,
        keywords: formData.keywords || null,

        description: formData.description || null,
        assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
      });

      await updateWpSeoFields();

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'create_seo_tag',
          resource_type: 'seo_meta_tag',
          resource_id: null,
          details: { page_identifier: formData.page_identifier },
        });
      }

      toast({
        title: 'Success',
        description: 'SEO meta tag created successfully',
      });

      setIsCreateDialogOpen(false);
      setFormData({
        page_identifier: '',
        title: '',
        keywords: '',

        description: '',
        assigned_to: 'unassigned',
      });
      loadTags();
    } catch (error) {
      console.error('Failed to create SEO tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to create SEO meta tag',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedTag || !hasPermission('seo_meta_tags', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to update SEO meta tags',
        variant: 'destructive',
      });
      return;
    }

    try {
      await seoMetaTagsApi.update(selectedTag.id, {
        title: formData.title,
        keywords: formData.keywords || null,

        description: formData.description || null,
        assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
      });

      await updateWpSeoFields();

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'update_seo_tag',
          resource_type: 'seo_meta_tag',
          resource_id: selectedTag.id,
          details: { page_identifier: selectedTag.page_identifier },
        });
      }

      toast({
        title: 'Success',
        description: 'SEO meta tag updated successfully',
      });

      setIsEditDialogOpen(false);
      setSelectedTag(null);
      setFormData({
        page_identifier: '',
        title: '',
        keywords: '',

        description: '',
        assigned_to: 'unassigned',
      });
      loadTags();
    } catch (error) {
      console.error('Failed to update SEO tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update SEO meta tag',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTags(tags.map(tag => tag.id));
    } else {
      setSelectedTags([]);
    }
  };

  const handleSelectTag = (tagId: string, checked: boolean) => {
    if (checked) {
      setSelectedTags([...selectedTags, tagId]);
    } else {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTags.length === 0) return;

    try {
      await bulkOperations.bulkDelete('seo_meta', selectedTags); // Correct table name used in backend logic usually

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'bulk_delete_seo_tags',
          resource_type: 'seo_meta_tag',
          resource_id: null,
          details: { count: selectedTags.length },
        });
      }

      toast({
        title: 'Success',
        description: `Deleted ${selectedTags.length} SEO tags`,
      });

      setSelectedTags([]);
      loadTags();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete selected tags',
        variant: 'destructive',
      });
    }
  };

  const handleBulkAssign = async () => {
    if (selectedTags.length === 0) return;

    try {
      const assignedTo = bulkAssignUser === 'unassigned' ? null : bulkAssignUser;
      await bulkOperations.bulkUpdate('seo_meta', selectedTags, { assigned_to: assignedTo });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'bulk_assign_seo_tags',
          resource_type: 'seo_meta_tag',
          resource_id: null,
          details: { count: selectedTags.length, assigned_to: assignedTo },
        });
      }

      toast({
        title: 'Success',
        description: `Assigned ${selectedTags.length} tags successfully`,
      });

      setIsBulkAssignDialogOpen(false);
      setSelectedTags([]);
      setBulkAssignUser('unassigned');
      loadTags();
    } catch (error) {
      console.error('Failed to bulk assign:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign selected tags',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (tag: SeoMetaTag) => {
    if (!hasPermission('seo_meta_tags', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to delete SEO meta tags',
        variant: 'destructive',
      });
      return;
    }

    try {
      await seoMetaTagsApi.delete(tag.id);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_seo_tag',
          resource_type: 'seo_meta_tag',
          resource_id: tag.id,
          details: { page_identifier: tag.page_identifier },
        });
      }

      toast({
        title: 'Success',
        description: 'SEO meta tag deleted successfully',
      });

      loadTags();
    } catch (error) {
      console.error('Failed to delete SEO tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete SEO meta tag',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (tag: SeoMetaTag) => {
    setSelectedTag(tag);
    setFormData({
      page_identifier: tag.page_identifier,
      title: tag.title,
      keywords: tag.keywords || '',

      description: tag.description || '',
      assigned_to: tag.assigned_to || 'unassigned',
    });
    setIsEditDialogOpen(true);
  };

  const [postTypes, setPostTypes] = useState<WPPostType[]>([])
  const [posts, setPosts] = useState<WPPost[]>([])

  type SeoFormNew = {
    post_type: string
    rest_base: string
    post_id: string
    title: string
    keywords: string
    description: string
  }

  const [formDatanew, setFormDataNew] = useState<SeoFormNew>({
    post_type: "",
    rest_base: "",
    post_id: "",
    title: "",
    keywords: "",
    description: ""
  })

  const ALLOWED_POST_TYPES = ["post", "page", "service", "sub-service", "healthcare"]

  useEffect(() => {
    fetch("https://digitmarketus.com/Bhairavi/wp-json/wp/v2/types")
      .then(res => res.json())
      .then((data: Record<string, WPPostType>) => {
        const types = Object.keys(data)
          .filter(slug => ALLOWED_POST_TYPES.includes(slug))
          .map(slug => {
            const type = data[slug]

            return {
              slug,
              name:
                type.labels?.name ||
                type.name ||
                slug,
              rest_base: type.rest_base || slug
            }
          })

        //console.log("POST TYPES:", types)
        setPostTypes(types)
      })
  }, [])

  useEffect(() => {
    if (!formDatanew.rest_base) {
      setPosts([])
      return
    }

    fetch(
      `https://digitmarketus.com/Bhairavi/wp-json/wp/v2/${formDatanew.rest_base}?per_page=100`
    )
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPosts(data)
        } else {
          setPosts([])
        }
      })
      .catch(() => setPosts([]))
  }, [formDatanew.rest_base])

  const usedPostIdsByType = tags.reduce<Record<string, Set<string>>>(
    (acc, tag) => {
      const [type, id] = tag.page_identifier.split(":")
      if (!acc[type]) acc[type] = new Set()
      acc[type].add(id)
      return acc
    },
    {}
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 bg-muted" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Meta Tags</h1>
          <p className="text-muted-foreground">Manage SEO meta tags for your website pages</p>
        </div>
        <div className="flex gap-2">
          {selectedTags.length > 0 && hasPermission('seo_meta_tags', 'write') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Bulk Actions ({selectedTags.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsBulkAssignDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign to User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasPermission('seo_meta_tags', 'write') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Meta Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create SEO Meta Tag</DialogTitle>
                  <DialogDescription>Add SEO meta tags for a page</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Post Type</Label>
                    <Select
                      value={formDatanew.post_type}
                      onValueChange={(value) => {
                        const selected = postTypes.find(t => t.slug === value)

                        setFormDataNew({
                          ...formDatanew,
                          post_type: value,
                          rest_base: selected?.rest_base || value,
                          post_id: ""
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select post type" />
                      </SelectTrigger>

                      <SelectContent>
                        {postTypes.map(type => (
                          <SelectItem key={type.slug} value={type.slug}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Page / Post</Label>
                    <Select
                      value={formDatanew.post_id}
                      disabled={!formDatanew.post_type}
                      onValueChange={(value) =>
                        setFormDataNew({ ...formDatanew, post_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select page or post" />
                      </SelectTrigger>

                      <SelectContent>
                        {posts
                          .filter(post => {
                            const usedIds =
                              usedPostIdsByType[formDatanew.post_type] || new Set()
                            return !usedIds.has(post.id.toString())
                          })
                          .map(post => (
                            <SelectItem key={post.id} value={post.id.toString()}>
                              {post.title.rendered}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Page title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Page description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Assigned To</Label>
                    <Select
                      value={formData.assigned_to}
                      onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All SEO Meta Tags</CardTitle>
          <CardDescription>Manage meta tags for different pages</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedTags.length === tags.length && tags.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No SEO meta tags found
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={(checked) => handleSelectTag(tag.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {tag.page_identifier}
                    </TableCell>
                    <TableCell>{tag.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{tag.keywords || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{tag.description || '-'}</TableCell>
                    <TableCell>
                      {users.find(u => u.id === tag.assigned_to)?.username || 'Unassigned'}
                    </TableCell>
                    <TableCell>{new Date(tag.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {hasPermission('seo_meta_tags', 'write') && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(tag)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the SEO meta tag for {tag.page_identifier}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(tag)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SEO Meta Tag</DialogTitle>
            <DialogDescription>Update SEO meta tags for {selectedTag?.page_identifier}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Page title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-keywords">Keywords</Label>
              <Input
                id="edit-keywords"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Page description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assigned_to">Assigned To</Label>
              <Select
                value={formData.assigned_to || 'unassigned'}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkAssignDialogOpen} onOpenChange={setIsBulkAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Users</DialogTitle>
            <DialogDescription>
              Assign the selected {selectedTags.length} items to a user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={bulkAssignUser} onValueChange={setBulkAssignUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
