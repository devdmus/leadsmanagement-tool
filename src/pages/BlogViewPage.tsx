import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWordPressApi } from '@/hooks/useWordPressApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft,
    Calendar,
    User,
    Edit,
    Tag as TagIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type Blog = {
    id: string;
    title: string;
    description: string;
    content: string | null;
    feature_image: string | null;
    category: string;
    tags: string[];
    status: string;
    published_at: string | null;
    author?: { id: string; username: string };
};

export default function BlogViewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const wordpressApi = useWordPressApi();
    const { toast } = useToast();
    const { profile } = useAuth();
    const canEditBlog = ['super_admin', 'admin', 'seo_manager', 'seo_person'].includes(profile?.role || '');

    const [blog, setBlog] = useState<Blog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBlog();
    }, [id]);

    const loadBlog = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // WordPress has a getPost method, assuming we can get the specific post or fetch all and find it
            const allPosts = await wordpressApi.getAllPosts();
            const post = allPosts.find((p: any) => String(p.id) === id);
            
            if (!post) throw new Error('Blog not found');

            const cats = post._embedded?.['wp:term']?.[0] || [];
            const tgs = post._embedded?.['wp:term']?.[1] || [];

            const mapped: Blog = {
                id: String(post.id),
                title: post.title.rendered,
                description: post.excerpt.rendered.replace(/<[^>]*>/g, '').trim(),
                content: post.content.rendered,
                feature_image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
                category: cats[0]?.name || 'Uncategorized',
                tags: tgs.map((t: any) => t.name),
                status: post.status,
                published_at: post.date,
                author: {
                    id: String(post.author),
                    username: post._embedded?.author?.[0]?.name || 'Admin',
                },
            };
            setBlog(mapped);
        } catch (error) {
            console.error('Failed to load blog:', error);
            toast({ title: 'Error', description: 'Failed to load blog details', variant: 'destructive' });
        } finally {
            setLoading(false);
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
                <Skeleton className="h-[400px] w-full" />
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
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/blogs')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Blogs
                </Button>
                {canEditBlog && (
                    <Button onClick={() => navigate(`/blogs/${blog.id}`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Blog
                    </Button>
                )}
            </div>

            {/* Top Heading like BlogDetailPage */}
            <div className="flex items-start gap-4 mb-4">
                {blog.feature_image && (
                    <img
                        src={blog.feature_image}
                        alt={blog.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                )}
                <div>
                    <h1 className="text-3xl font-bold">{blog.title}</h1>
                    <div className="flex items-center gap-3 mt-1 text-muted-foreground text-sm">
                        <Badge className={getStatusBadgeClass(blog.status)}>
                            {blog.status.charAt(0).toUpperCase() + blog.status.slice(1)}
                        </Badge>
                        <span className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            {blog.author?.username || 'Admin'}
                        </span>
                        {blog.published_at && (
                            <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" />
                                {new Date(blog.published_at).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Read-Only Details Card Form Layout */}
            <Card>
                <CardContent className="space-y-6 pt-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Title</div>
                        <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20">
                            {blog.title}
                        </div>
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">Excerpt / Description</div>
                        <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20 min-h-[80px]">
                            {blog.description || 'No excerpt provided.'}
                        </div>
                        <p className="text-xs text-muted-foreground">Used as the excerpt in WordPress</p>
                    </div>

                    {/* Category & Assigned To */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Category</div>
                            <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20">
                                {blog.category || 'Uncategorized'}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Assigned To</div>
                            <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20">
                                {/* In read-only mode without fetching users table, we just don't have assigned_to name easily unless it's in the payload. Showing ID or unassigned based on available data. */}
                                Unassigned / View Only
                            </div>
                        </div>
                    </div>

                    {/* Status & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Status</div>
                            <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20 capitalize">
                                {blog.status}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">Tags</div>
                            <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm opacity-100 bg-muted/20 flex items-center min-h-[40px]">
                                {blog.tags.length > 0
                                    ? <span className="flex items-center gap-2 font-medium"><TagIcon className="h-4 w-4" /> {blog.tags.length} tag(s) selected</span>
                                    : 'No tags selected'}
                            </div>
                            {blog.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {blog.tags.map((tag, idx) => (
                                        <Badge key={idx} className="bg-[#22c55e] hover:bg-[#22c55e] text-white">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rich HTML Content Rendering (if user wants to see the actual content too) */}
                    <div className="mt-8 border-t pt-8">
                        <div className="text-sm font-medium text-foreground mb-4">Full Content</div>
                        {blog.content ? (
                            <div 
                                className="prose prose-sm sm:prose-base dark:prose-invert max-w-none p-4 rounded-md border bg-muted/5"
                                dangerouslySetInnerHTML={{ __html: blog.content }} 
                            />
                        ) : (
                            <div className="text-muted-foreground italic py-10 border rounded-lg bg-muted/20 text-center">
                                No full content available for this blog post.
                            </div>
                        )}
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
