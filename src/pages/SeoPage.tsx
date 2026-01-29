import { useEffect, useState } from 'react';
import { seoMetaTagsApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
type SeoMetaTag = {
  id: string;
  page_identifier: string;
  title: string;
  keywords: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};
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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function SeoPage() {
  const [tags, setTags] = useState<SeoMetaTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<SeoMetaTag | null>(null);
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    page_identifier: '',
    title: '',
    keywords: '',
    description: '',
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const data = await seoMetaTagsApi.getAll();
      setTags(data);
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
      await seoMetaTagsApi.create({
        page_identifier: formData.page_identifier,
        title: formData.title,
        keywords: formData.keywords || null,
        description: formData.description || null,
      });

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
      });

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
    });
    setIsEditDialogOpen(true);
  };

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
                  <Label htmlFor="page_identifier">Page Identifier</Label>
                  <Input
                    id="page_identifier"
                    value={formData.page_identifier}
                    onChange={(e) => setFormData({ ...formData, page_identifier: e.target.value })}
                    placeholder="e.g., /about, /products"
                  />
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

      <Card>
        <CardHeader>
          <CardTitle>All SEO Meta Tags</CardTitle>
          <CardDescription>Manage meta tags for different pages</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Description</TableHead>
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
                    <TableCell className="font-medium">{tag.page_identifier}</TableCell>
                    <TableCell>{tag.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{tag.keywords || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{tag.description || '-'}</TableCell>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
