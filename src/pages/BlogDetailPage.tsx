import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { profilesApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    ArrowLeft,
    Trash2,
    Save,
    Image as ImageIcon,
    Upload,
    X,
    Loader2,
    Tag as TagIcon,
    Calendar,
    User,
    FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type WPCategory = { id: number; name: string; slug: string; count: number };
type WPTag = { id: number; name: string; slug: string; count: number };
type Profile = { id: string; username: string; email: string | null; role: string };

type Blog = {
    id: string;
    title: string;
    description: string;
    content: string | null;
    feature_image: string | null;
    feature_image_id: number | null;
    category: string;
    category_id: number | null;
    tags: string[];
    tag_ids: number[];
    author_id: string;
    status: string;
    published_at: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    author?: { id: string; username: string };
};

export default function BlogDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { currentSite } = useSite();
    const { toast } = useToast();
    const wordpressApi = useWordPressApi();

    const [blog, setBlog] = useState<Blog | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [categories, setCategories] = useState<WPCategory[]>([]);
    const [tags, setTags] = useState<WPTag[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content: '',
        feature_image: '',
        feature_image_id: null as number | null,
        category: '',
        category_id: null as number | null,
        tags: [] as string[],
        tag_ids: [] as number[],
        status: 'draft',
        assigned_to: 'unassigned',
    });

    useEffect(() => {
        loadAll();
    }, [id, currentSite?.id]);

    const mapWpPostToBlog = (post: any): Blog => {
        const cats = post._embedded?.['wp:term']?.[0] || [];
        const tgs = post._embedded?.['wp:term']?.[1] || [];
        return {
            id: String(post.id),
            title: post.title.rendered,
            description: post.excerpt.rendered.replace(/<[^>]*>/g, '').trim(),
            content: post.content.rendered,
            feature_image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
            feature_image_id: post.featured_media || null,
            category: cats[0]?.name || 'Uncategorized',
            category_id: cats[0]?.id || null,
            tags: tgs.map((t: any) => t.name),
            tag_ids: tgs.map((t: any) => t.id),
            author_id: String(post.author),
            assigned_to: post.assigned_to || null,
            status: post.status,
            published_at: post.date,
            created_at: post.date,
            updated_at: post.modified,
            author: {
                id: String(post.author),
                username: post._embedded?.author?.[0]?.name || 'Admin',
            },
        };
    };

    const loadAll = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [allPosts, wpCategories, wpTags, usersData] = await Promise.all([
                wordpressApi.getAllPosts(),
                wordpressApi.getCategories(),
                wordpressApi.getTags(),
                profilesApi.getAll(),
            ]);

            const post = allPosts.find((p: any) => String(p.id) === id);
            if (!post) throw new Error('Blog not found');

            const mapped = mapWpPostToBlog(post);
            setBlog(mapped);
            setCategories(wpCategories);
            setTags(wpTags);
            setUsers(usersData as Profile[]);

            setFormData({
                title: mapped.title,
                description: mapped.description,
                content: mapped.content || '',
                feature_image: mapped.feature_image || '',
                feature_image_id: mapped.feature_image_id,
                category: mapped.category,
                category_id: mapped.category_id,
                tags: mapped.tags,
                tag_ids: mapped.tag_ids,
                status: mapped.status,
                assigned_to: (mapped as any).assigned_to || 'unassigned',
            });
        } catch (error) {
            console.error('Failed to load blog:', error);
            toast({ title: 'Error', description: 'Failed to load blog details', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile || !id) return;
        if (!formData.title.trim()) {
            toast({ title: 'Validation Error', description: 'Title is required', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const postData = {
                title: formData.title,
                content: formData.content || '',
                excerpt: formData.description,
                status: formData.status as 'draft' | 'publish' | 'private',
                ...(formData.feature_image_id && { featured_media: formData.feature_image_id }),
                ...(formData.category_id && { categories: [formData.category_id] }),
                ...(formData.tag_ids.length > 0 && { tags: formData.tag_ids }),
                assigned_to:
                    formData.assigned_to === 'unassigned' ? (profile?.id || null) : formData.assigned_to,
            };

            await wordpressApi.updatePost(Number(id), postData);

            await activityLogsApi.create({
                user_id: profile.id as string,
                action: 'update_blog',
                resource_type: 'blog',
                resource_id: id,
                details: { title: formData.title },
            });

            toast({ title: 'Success', description: 'Blog updated successfully' });
            await loadAll();
        } catch (error) {
            console.error('Failed to update blog:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update blog',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!id || !profile) return;
        try {
            await wordpressApi.deletePost(Number(id), true);
            await activityLogsApi.create({
                user_id: profile.id as string,
                action: 'delete_blog',
                resource_type: 'blog',
                resource_id: id,
                details: { title: blog?.title },
            });
            toast({ title: 'Success', description: 'Blog deleted successfully' });
            navigate('/blogs');
        } catch (error) {
            console.error('Failed to delete blog:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete blog',
                variant: 'destructive',
            });
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Error', description: 'Image size should not exceed 5MB', variant: 'destructive' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Error', description: 'Please upload a valid image file', variant: 'destructive' });
            return;
        }
        setUploading(true);
        try {
            const media = await wordpressApi.uploadMedia(file);
            setFormData(prev => ({ ...prev, feature_image: media.url, feature_image_id: media.id }));
            toast({ title: 'Success', description: 'Image uploaded successfully' });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload image',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, feature_image: '', feature_image_id: null }));
    };

    const handleCategoryChange = (categoryName: string) => {
        const cat = categories.find(c => c.name === categoryName);
        setFormData(prev => ({ ...prev, category: categoryName, category_id: cat?.id || null }));
    };

    const handleTagToggle = (tagName: string) => {
        const tag = tags.find(t => t.name === tagName);
        if (!tag) return;
        const isSelected = formData.tags.includes(tagName);
        if (isSelected) {
            setFormData(prev => ({
                ...prev,
                tags: prev.tags.filter(t => t !== tagName),
                tag_ids: prev.tag_ids.filter(tid => tid !== tag.id),
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                tags: [...prev.tags, tagName],
                tag_ids: [...prev.tag_ids, tag.id],
            }));
        }
    };

    const getStatusBadgeClass = (status: string) => {
        const map: Record<string, string> = {
            draft: 'bg-gray-500 text-white',
            publish: 'bg-green-500 text-white',
            private: 'bg-red-500 text-white',
            pending: 'bg-yellow-500 text-white',
            future: 'bg-blue-500 text-white',
        };
        return map[status] || 'bg-gray-500 text-white';
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!blog) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Blog Not Found</h2>
                    <p className="text-muted-foreground mb-4">The blog post you're looking for doesn't exist.</p>
                    <Button onClick={() => navigate('/blogs')}>Back to Blogs</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top bar */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/blogs')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Blogs
                </Button>

                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving || uploading}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Blog
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Blog?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete "{blog.title}" from WordPress. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Blog Detail Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start gap-4">
                        {blog.feature_image && (
                            <img
                                src={blog.feature_image}
                                alt=""
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                        )}
                        <div>
                            <CardTitle className="text-2xl">{blog.title}</CardTitle>
                            <CardDescription className="flex items-center gap-3 mt-1">
                                <Badge className={getStatusBadgeClass(blog.status)}>
                                    {blog.status.charAt(0).toUpperCase() + blog.status.slice(1)}
                                </Badge>
                                <span className="flex items-center gap-1 text-xs">
                                    <User className="h-3 w-3" />
                                    {blog.author?.username || 'Admin'}
                                </span>
                                {blog.published_at && (
                                    <span className="flex items-center gap-1 text-xs">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(blog.published_at).toLocaleDateString()}
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter blog title"
                            disabled={saving}
                        />
                    </div>

                    {/* Excerpt — full width */}
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            Excerpt / Description <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief description or excerpt"
                            rows={3}
                            disabled={saving}
                        />
                        <p className="text-xs text-muted-foreground">Used as the excerpt in WordPress</p>
                    </div>

                    {/* Category + Assigned To — side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={handleCategoryChange}
                                disabled={saving}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="assigned_to">Assigned To</Label>
                            <Select
                                value={formData.assigned_to}
                                onValueChange={value => setFormData(prev => ({ ...prev, assigned_to: value }))}
                                disabled={saving}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.username} ({user.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Status + Tags — side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={value => setFormData(prev => ({ ...prev, status: value }))}
                                disabled={saving}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="publish">Publish</SelectItem>
                                    <SelectItem value="private">Private</SelectItem>
                                    <SelectItem value="pending">Pending Review</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Tags</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        <TagIcon className="h-4 w-4 mr-2" />
                                        {formData.tags.length > 0
                                            ? `${formData.tags.length} tag(s) selected`
                                            : 'Select tags'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[340px] p-4">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Select Tags</p>
                                        <div className="max-h-[200px] overflow-y-auto space-y-2">
                                            {tags.map(tag => (
                                                <div key={tag.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`tag-${tag.id}`}
                                                        checked={formData.tags.includes(tag.name)}
                                                        onChange={() => handleTagToggle(tag.name)}
                                                        className="rounded border-gray-300"
                                                    />
                                                    <label htmlFor={`tag-${tag.id}`} className="text-sm flex-1 cursor-pointer">
                                                        {tag.name}
                                                    </label>
                                                    <span className="text-xs text-muted-foreground">({tag.count})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.tags.map((tag, idx) => (
                                        <Badge key={idx} variant="secondary">
                                            {tag}
                                            <button onClick={() => handleTagToggle(tag)} className="ml-1 hover:text-destructive">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Feature Image Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Feature Image
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {formData.feature_image ? (
                        <div className="relative">
                            <img
                                src={formData.feature_image}
                                alt="Feature"
                                className="w-full max-h-72 object-cover rounded-lg"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={handleRemoveImage}
                                disabled={uploading || saving}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/50 transition-colors">
                            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <Label htmlFor="image-upload-detail" className="cursor-pointer inline-block">
                                <div className="flex items-center justify-center gap-2">
                                    {uploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Uploading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            <span className="font-medium">Upload Image</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF up to 5MB</p>
                            </Label>
                            <Input
                                id="image-upload-detail"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                                disabled={uploading || saving}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Full Content Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Full Content
                    </CardTitle>
                    <CardDescription>Write the full body of your blog post</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <ReactQuill
                            theme="snow"
                            value={formData.content}
                            onChange={value => setFormData(prev => ({ ...prev, content: value }))}
                            placeholder="Write your full blog content here..."
                            readOnly={saving}
                            style={{ minHeight: '300px' }}
                            modules={{
                                toolbar: [
                                    [{ header: [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline', 'strike'],
                                    [{ list: 'ordered' }, { list: 'bullet' }],
                                    [{ align: [] }],
                                    ['link', 'image'],
                                    ['blockquote', 'code-block'],
                                    ['clean'],
                                ],
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Save bar at bottom */}
            <div className="flex justify-end gap-3 pb-6">
                <Button variant="outline" onClick={() => navigate('/blogs')}>
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || uploading}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
