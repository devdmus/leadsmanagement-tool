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
import { Plus, Edit, Trash2, Globe, CheckCircle, ExternalLink, KeyRound, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWordPressApi } from '@/db/wordpressApi';

export default function SitesPage() {
    const { sites, currentSite, addSite, updateSite, deleteSite, setCurrentSite } = useSite();
    const { toast } = useToast();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<WordPressSite | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail'>>({});

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        username: '',
        appPassword: '',
    });

    const resetForm = () => {
        setFormData({ name: '', url: '', username: '', appPassword: '' });
    };

    const handleAdd = () => {
        if (!formData.name || !formData.url) {
            toast({ title: 'Error', description: 'Name and URL are required', variant: 'destructive' });
            return;
        }
        addSite({
            name: formData.name,
            url: formData.url,
            username: formData.username || undefined,
            appPassword: formData.appPassword || undefined,
        });
        toast({ title: 'Site Added', description: `${formData.name} has been connected.` });
        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEdit = () => {
        if (!editingSite) return;
        updateSite(editingSite.id, {
            name: formData.name,
            url: formData.url,
            username: formData.username || undefined,
            // Only update password if a new one was entered
            ...(formData.appPassword ? { appPassword: formData.appPassword } : {}),
        });
        toast({ title: 'Site Updated', description: `${formData.name} credentials saved.` });
        setIsEditDialogOpen(false);
        setEditingSite(null);
        resetForm();
    };

    const handleDelete = (site: WordPressSite) => {
        deleteSite(site.id);
        toast({ title: 'Site Removed', description: `${site.name} has been disconnected.` });
    };

    const openEditDialog = (site: WordPressSite) => {
        setEditingSite(site);
        setFormData({
            name: site.name,
            url: site.url,
            username: site.username || '',
            appPassword: '',   // Never pre-fill password for security
        });
        setIsEditDialogOpen(true);
    };

    const handleSelectSite = (siteId: string) => {
        setCurrentSite(siteId);
        toast({ title: 'Site Switched', description: `Now working with: ${sites.find(s => s.id === siteId)?.name}` });
    };

    // Test connection for a site using its saved credentials
    const handleTestConnection = async (site: WordPressSite) => {
        if (!site.username || !site.appPassword) {
            toast({
                title: 'No Credentials',
                description: 'Add a username and application password first, then test the connection.',
                variant: 'destructive',
            });
            return;
        }

        setTestingId(site.id);
        try {
            const authHeader = 'Basic ' + btoa(`${site.username}:${site.appPassword}`);
            const api = createWordPressApi(site.url, { Authorization: authHeader });
            // Fetch users as a lightweight connectivity test
            await api.getUsers(undefined, { Authorization: authHeader });
            setTestResults(prev => ({ ...prev, [site.id]: 'ok' }));
            toast({ title: '✅ Connection Successful', description: `${site.name} credentials are working correctly.` });
        } catch {
            setTestResults(prev => ({ ...prev, [site.id]: 'fail' }));
            toast({
                title: '❌ Connection Failed',
                description: `Could not connect to ${site.name}. Check the URL and application password.`,
                variant: 'destructive',
            });
        } finally {
            setTestingId(null);
        }
    };

    // Credential form fields — reused in both Add and Edit dialogs
    const CredentialFields = ({ isEdit = false }: { isEdit?: boolean }) => (
        <>
            <div className="rounded-md border border-dashed p-4 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    WordPress Credentials
                </p>
                <div className="space-y-2">
                    <Label htmlFor={isEdit ? 'edit-username' : 'username'}>Username</Label>
                    <Input
                        id={isEdit ? 'edit-username' : 'username'}
                        placeholder="WordPress admin username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={isEdit ? 'edit-appPassword' : 'appPassword'}>Application Password</Label>
                    <Input
                        id={isEdit ? 'edit-appPassword' : 'appPassword'}
                        type="password"
                        placeholder={isEdit ? 'Leave blank to keep existing password' : 'xxxx xxxx xxxx xxxx'}
                        value={formData.appPassword}
                        onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                        Generate in WP Admin → Users → Profile → Application Passwords
                    </p>
                </div>
            </div>
        </>
    );

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
                                Connect a new WordPress website. Add credentials now so the app can fetch users, logs, and content from it.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Site Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Kota Site"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="url">WordPress URL *</Label>
                                <Input
                                    id="url"
                                    placeholder="https://example.com/subsite"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Base URL without /wp-json (e.g. https://digitmarketus.com/kota)
                                </p>
                            </div>
                            <CredentialFields isEdit={false} />
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

            {/* Site Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => {
                    const hasCredentials = !!(site.username && site.appPassword);
                    const testResult = testResults[site.id];
                    const isTesting = testingId === site.id;

                    return (
                        <Card
                            key={site.id}
                            className={`relative transition-all ${currentSite?.id === site.id
                                ? 'ring-2 ring-primary shadow-lg'
                                : 'hover:shadow-md'
                                }`}
                        >
                            {/* Active badge */}
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
                                    {site.isDefault && <Badge variant="secondary">Default</Badge>}
                                </div>
                                <CardDescription className="truncate">{site.url}</CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="space-y-3">
                                    {/* Credential status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm">
                                            {hasCredentials ? (
                                                <>
                                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                                    <span className="text-green-600 font-medium">Credentials saved</span>
                                                    <span className="text-muted-foreground">({site.username})</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                                                    <span className="text-amber-600 font-medium">No credentials</span>
                                                </>
                                            )}
                                        </div>
                                        {/* Test result indicator */}
                                        {testResult && (
                                            <Badge variant={testResult === 'ok' ? 'default' : 'destructive'} className="text-xs">
                                                {testResult === 'ok' ? '✅ Connected' : '❌ Failed'}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Action buttons row 1 */}
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
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(site)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
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
                                                        <AlertDialogTitle>Remove Site?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will disconnect "{site.name}" from your app. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(site)}>Remove</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>

                                    {/* Test Connection button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        disabled={isTesting || !hasCredentials}
                                        onClick={() => handleTestConnection(site)}
                                    >
                                        {isTesting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="h-4 w-4 mr-2" />
                                        )}
                                        {isTesting ? 'Testing...' : hasCredentials ? 'Test Connection' : 'Add credentials to test'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Site — {editingSite?.name}</DialogTitle>
                        <DialogDescription>
                            Update site details and credentials. Credentials are used to fetch users, activity logs, and content from this site.
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
                            <p className="text-xs text-muted-foreground">
                                Base URL without /wp-json
                            </p>
                        </div>
                        <CredentialFields isEdit={true} />
                        {editingSite?.username && (
                            <p className="text-xs text-muted-foreground -mt-2">
                                Current username: <strong>{editingSite.username}</strong>. Leave password blank to keep existing.
                            </p>
                        )}
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
