import { useState } from 'react';
import { useSite, WordPressSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Globe, CheckCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SitesPage() {
    const { sites, currentSite, addSite, updateSite, deleteSite, setCurrentSite } = useSite();
    const { toast } = useToast();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<WordPressSite | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        username: '',
        appPassword: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            url: '',
            username: '',
            appPassword: '',
        });
    };

    const handleAdd = () => {
        if (!formData.name || !formData.url) {
            toast({
                title: 'Error',
                description: 'Name and URL are required',
                variant: 'destructive',
            });
            return;
        }

        addSite({
            name: formData.name,
            url: formData.url,
            username: formData.username || undefined,
            appPassword: formData.appPassword || undefined,
        });

        toast({
            title: 'Success',
            description: 'Site added successfully',
        });

        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEdit = () => {
        if (!editingSite) return;

        updateSite(editingSite.id, {
            name: formData.name,
            url: formData.url,
            username: formData.username || undefined,
            appPassword: formData.appPassword || undefined,
        });

        toast({
            title: 'Success',
            description: 'Site updated successfully',
        });

        setIsEditDialogOpen(false);
        setEditingSite(null);
        resetForm();
    };

    const handleDelete = (site: WordPressSite) => {
        deleteSite(site.id);
        toast({
            title: 'Success',
            description: 'Site deleted successfully',
        });
    };

    const openEditDialog = (site: WordPressSite) => {
        setEditingSite(site);
        setFormData({
            name: site.name,
            url: site.url,
            username: site.username || '',
            appPassword: site.appPassword || '',
        });
        setIsEditDialogOpen(true);
    };

    const handleSelectSite = (siteId: string) => {
        setCurrentSite(siteId);
        toast({
            title: 'Site Changed',
            description: `Now working with: ${sites.find(s => s.id === siteId)?.name}`,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">WordPress Sites</h1>
                    <p className="text-muted-foreground">Manage your connected WordPress websites</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Site
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add WordPress Site</DialogTitle>
                            <DialogDescription>
                                Connect a new WordPress website to manage its content
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Site Name</Label>
                                <Input
                                    id="name"
                                    placeholder="My WordPress Site"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="url">WordPress URL</Label>
                                <Input
                                    id="url"
                                    placeholder="https://example.com"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    The base URL of your WordPress site (without /wp-json)
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">WordPress Username (Optional)</Label>
                                <Input
                                    id="username"
                                    placeholder="admin"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appPassword">Application Password (Optional)</Label>
                                <Input
                                    id="appPassword"
                                    type="password"
                                    placeholder="xxxx xxxx xxxx xxxx"
                                    value={formData.appPassword}
                                    onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Generate in WP Admin → Users → Profile → Application Passwords
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleAdd}>Add Site</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => (
                    <Card
                        key={site.id}
                        className={`relative transition-all ${currentSite?.id === site.id
                                ? 'ring-2 ring-primary shadow-lg'
                                : 'hover:shadow-md'
                            }`}
                    >
                        {currentSite?.id === site.id && (
                            <div className="absolute -top-2 -right-2">
                                <Badge className="bg-primary">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Active
                                </Badge>
                            </div>
                        )}
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                    <CardTitle className="text-lg">{site.name}</CardTitle>
                                </div>
                                {site.isDefault && (
                                    <Badge variant="secondary">Default</Badge>
                                )}
                            </div>
                            <CardDescription className="truncate">
                                {site.url}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {site.username ? (
                                        <span>Credentials: {site.username}</span>
                                    ) : (
                                        <span>No credentials saved</span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {currentSite?.id !== site.id && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleSelectSite(site.id)}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Select
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(site)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                    >
                                        <a href={site.url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                    {!site.isDefault && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Site?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will remove "{site.name}" from your connected sites.
                                                        This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(site)}>
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Site</DialogTitle>
                        <DialogDescription>
                            Update the site configuration
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Site Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-url">WordPress URL</Label>
                            <Input
                                id="edit-url"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-username">WordPress Username</Label>
                            <Input
                                id="edit-username"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-appPassword">Application Password</Label>
                            <Input
                                id="edit-appPassword"
                                type="password"
                                placeholder="Leave blank to keep existing"
                                value={formData.appPassword}
                                onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingSite(null); resetForm(); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
