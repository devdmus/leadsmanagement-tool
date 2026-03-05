import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Shield, Globe, History, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWordPressApi } from '@/db/wordpressApi';
import { getCurrentSiteFromCache, getAllSitesFromCache } from '@/utils/siteCache';

// Dynamically get the current site's wp-json base from siteCache
function getCurrentWpJsonBase(): string {
    try {
        const site = getCurrentSiteFromCache();
        if (site?.url) {
            let url = site.url.replace(/\/$/, '');
            if (!url.includes('/wp-json')) url += '/wp-json';
            return url;
        }
    } catch (_) { }
    return '';
}

interface WhitelistedIP {
    id: string;
    ip: string;
    userId: string;
    username: string;
    label: string;
    addedBy: string;
    addedAt: string;
}

interface IPLog {
    id?: string;
    action: string;
    details?: any;
    user_id?: string;
    created_at?: string;
    // legacy local fields
    ip?: string;
    loginIP?: string;
    currentIP?: string;
    oldIP?: string;
    newIP?: string;
    userId?: string;
    username?: string;
    timestamp?: string;
}

export default function IPSecurityPage() {
    const { profile, getWpAuthHeader } = useAuth();
    const { currentSite } = useSite();
    const { toast } = useToast();

    const [whitelist, setWhitelist] = useState<WhitelistedIP[]>([]);
    const [logs, setLogs] = useState<IPLog[]>([]);
    const [users, setUsers] = useState<Array<{ id: string; username: string }>>([]);
    const [currentIP, setCurrentIP] = useState<string | null>(null);

    const [loadingWhitelist, setLoadingWhitelist] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [savingIP, setSavingIP] = useState(false);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [formData, setFormData] = useState({ ip: '', userId: '', label: '' });

    // Get auth header for the current site
    const getSiteAuth = (): string => {
        try {
            // 1. Try per-site credentials for the current site
            const currentSiteId = localStorage.getItem('crm_current_site_id');
            const siteCreds = localStorage.getItem('crm_site_credentials');
            if (currentSiteId && siteCreds) {
                const map = JSON.parse(siteCreds);
                const creds = map[currentSiteId];
                if (creds?.username && creds?.password) {
                    return 'Basic ' + btoa(`${creds.username}:${creds.password}`);
                }
            }
        } catch (_) { }
        // 2. Fallback: use whatever global credentials are stored
        return getWpAuthHeader();
    };

    const getApi = useCallback(() => {
        const authHeader = getSiteAuth();
        const wpJsonBase = getCurrentWpJsonBase();
        if (!wpJsonBase) {
            console.warn('No site configured for IP Security');
            return createWordPressApi('', { Authorization: authHeader });
        }
        return createWordPressApi(wpJsonBase, { Authorization: authHeader });
    }, []);

    // ── Fetch whitelist from WordPress ─────────────────────────────────────────
    const fetchWhitelist = useCallback(async () => {
        setLoadingWhitelist(true);
        try {
            const api = getApi();
            const data = await api.getIPWhitelist();
            setWhitelist(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.warn('Could not load IP whitelist from server:', err);
            toast({
                title: 'Could not load whitelist',
                description: err?.message || 'Ensure the WordPress plugin endpoint is installed.',
                variant: 'destructive',
            });
            setWhitelist([]);
        } finally {
            setLoadingWhitelist(false);
        }
    }, []);

    // ── Fetch IP logs from WordPress /crm/v1/logs ──────────────────────────────
    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const api = getApi();
            const data = await api.getActivityLogs(1);
            // Filter to IP-related actions only
            const ipActions = ['login', 'logout', 'ip_whitelist_add', 'ip_whitelist_remove', 'unauthorized_attempt', 'permission_requested'];
            const filtered = (Array.isArray(data) ? data : []).filter((l: any) =>
                ipActions.includes(l.action)
            );
            setLogs(filtered);
        } catch (err) {
            console.warn('Could not load IP logs from server:', err);
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    }, []);

    // ── Load on mount / site change ────────────────────────────────────────────
    useEffect(() => {
        fetchWhitelist();
        fetchLogs();

        // Load users from ALL known sites and merge them (deduplicated by username)
        // so the admin can whitelist users from any site
        const loadUsers = async () => {
            const allUsers: Array<{ id: string; username: string; site: string }> = [];
            try {
                const sites = getAllSitesFromCache();
                const siteCreds: Record<string, { username: string; password: string }> =
                    JSON.parse(localStorage.getItem('crm_site_credentials') || '{}');

                for (const site of sites) {
                    const creds = siteCreds[site.id];
                    if (!creds) continue;
                    const auth = 'Basic ' + btoa(`${creds.username}:${creds.password}`);
                    const siteBase = site.url.replace(/\/$/, '') + '/wp-json';
                    try {
                        const res = await fetch(
                            `${siteBase}/wp/v2/users?context=view&per_page=100`,
                            { headers: { Authorization: auth } }
                        );
                        if (res.ok) {
                            const wpUsers = await res.json();
                            wpUsers.forEach((u: any) => {
                                const uname = u.name || u.slug;
                                // Deduplicate by username across sites
                                if (!allUsers.find(x => x.username === uname)) {
                                    allUsers.push({
                                        id: `${site.id}_${u.id}`,
                                        username: `${uname} (${site.name})`,
                                        site: site.id,
                                    });
                                }
                            });
                        }
                    } catch (_) { }
                }
            } catch (_) { }

            if (allUsers.length > 0) {
                setUsers(allUsers);
            } else {
                // Fallback mock
                setUsers([
                    { id: '1', username: 'Admin' },
                    { id: '2', username: 'Sales Agent' },
                ]);
            }
        };
        loadUsers();

        // Get current IP (only once)
        if (!currentIP) {
            fetch('https://api.ipify.org?format=json')
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.ip) setCurrentIP(data.ip); })
                .catch(() => { });
        }
    }, [currentSite?.id]);

    // ── Add IP ────────────────────────────────────────────────────────────────
    const handleAddIP = async () => {
        if (!formData.ip || !formData.userId) {
            toast({ title: 'Error', description: 'IP address and user are required', variant: 'destructive' });
            return;
        }
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(formData.ip)) {
            toast({ title: 'Invalid IP', description: 'Please enter a valid IP address (e.g., 192.168.1.1)', variant: 'destructive' });
            return;
        }

        const selectedUser = users.find(u => u.id === formData.userId);
        const newEntry: WhitelistedIP = {
            id: Math.random().toString(36).substr(2, 9),
            ip: formData.ip,
            userId: formData.userId,
            username: selectedUser?.username || 'Unknown',
            label: formData.label || 'Allowed IP',
            addedBy: String(profile?.username || 'Admin'),
            addedAt: new Date().toISOString(),
        };

        setSavingIP(true);
        try {
            const api = getApi();
            await api.addIPWhitelist(newEntry);
            await api.logActivity('ip_whitelist_add', `IP ${formData.ip} whitelisted for ${selectedUser?.username} by ${profile?.username}`);
            await fetchWhitelist();
            toast({ title: 'IP Added', description: `${formData.ip} is now whitelisted for ${selectedUser?.username}` });
            setFormData({ ip: '', userId: '', label: '' });
            setIsAddDialogOpen(false);
        } catch (err: any) {
            console.error('Add IP error:', err);
            toast({ title: 'Failed to add IP', description: err?.message || 'Unknown error', variant: 'destructive' });
        } finally {
            setSavingIP(false);
        }
    };

    // ── Remove IP ──────────────────────────────────────────────────────────────
    const handleRemoveIP = async (id: string) => {
        const removedEntry = whitelist.find(w => w.id === id);
        try {
            const api = getApi();
            await api.deleteIPWhitelist(id);
            if (removedEntry) {
                await api.logActivity('ip_whitelist_remove', `IP ${removedEntry.ip} removed for ${removedEntry.username} by ${profile?.username}`);
            }
            await fetchWhitelist();
            toast({ title: 'IP Removed', description: 'The IP address has been removed from the whitelist' });
        } catch (err) {
            toast({ title: 'Failed to remove IP', variant: 'destructive' });
        }
    };

    // ── Quick add current IP ───────────────────────────────────────────────────
    const handleAddCurrentIP = async (userId: string) => {
        if (!currentIP) return;
        const selectedUser = users.find(u => u.id === userId);
        const newEntry: WhitelistedIP = {
            id: Math.random().toString(36).substr(2, 9),
            ip: currentIP,
            userId,
            username: selectedUser?.username || 'Unknown',
            label: 'Current Device',
            addedBy: String(profile?.username || 'Admin'),
            addedAt: new Date().toISOString(),
        };

        try {
            const api = getApi();
            await api.addIPWhitelist(newEntry);
            await api.logActivity('ip_whitelist_add', `IP ${currentIP} (current device) whitelisted for ${selectedUser?.username} by ${profile?.username}`);
            await fetchWhitelist();
            toast({ title: 'Current IP Added', description: `${currentIP} is now whitelisted for ${selectedUser?.username}` });
        } catch (err) {
            toast({ title: 'Failed to add IP', variant: 'destructive' });
        }
    };

    // ── Approve permission request ─────────────────────────────────────────────
    const handleApproveRequest = (log: IPLog) => {
        const ip = log.ip || (log.details && typeof log.details === 'object' ? log.details.ip : '');
        const userId = log.user_id || log.userId || '';
        const username = log.username || userId;
        setFormData({ ip, userId, label: `Approved — requested by ${username}` });
        setIsAddDialogOpen(true);
    };

    // ── Guard ─────────────────────────────────────────────────────────────────
    if (!profile || profile.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">You don't have permission to access this page.</p>
            </div>
        );
    }

    // ── Helpers for log display ────────────────────────────────────────────────
    const getLogIP = (log: IPLog): string => {
        if (log.ip) return log.ip;
        if (log.details && typeof log.details === 'object') {
            if (log.details.ip) return log.details.ip;
            if (log.details.loginIP && log.details.currentIP)
                return `Login: ${log.details.loginIP} → Current: ${log.details.currentIP}`;
        }
        return '';
    };

    const getLogUsername = (log: IPLog): string =>
        log.username || log.user_id || log.userId || '—';

    const getLogTimestamp = (log: IPLog): string =>
        log.created_at || log.timestamp || '';

    const isAlertLog = (log: IPLog) =>
        log.action === 'ip_mismatch' || log.action === 'unauthorized_attempt';

    const isWarningLog = (log: IPLog) =>
        log.action === 'permission_requested';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        IP Security Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage allowed IP addresses — stored in WordPress, shared across all sites and devices
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap justify-end">
                    {currentIP && (
                        <Badge variant="outline" className="text-sm py-2 px-3">
                            <Globe className="h-4 w-4 mr-2" />
                            Your IP: {currentIP}
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { fetchWhitelist(); fetchLogs(); }}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add IP
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Whitelisted IP</DialogTitle>
                                <DialogDescription>
                                    Allow a specific IP address to access the system. This is saved to WordPress and applies to all devices instantly.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>IP Address</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g., 192.168.1.100"
                                            value={formData.ip}
                                            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                        />
                                        {currentIP && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setFormData({ ...formData, ip: currentIP })}
                                            >
                                                Use Mine
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>User</Label>
                                    <Select
                                        value={formData.userId}
                                        onValueChange={(value) => setFormData({ ...formData, userId: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.username}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Label (Optional)</Label>
                                    <Input
                                        placeholder="e.g., Office, Home, Mobile"
                                        value={formData.label}
                                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={savingIP}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddIP} disabled={savingIP}>
                                    {savingIP ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Add IP
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Whitelist Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Whitelisted IP Addresses</CardTitle>
                        <CardDescription>
                            Users can access the CRM from these IP addresses.
                            Changes apply to <strong>all sites and devices instantly</strong>.
                        </CardDescription>
                    </div>
                    {loadingWhitelist && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                    {whitelist.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No IP addresses whitelisted yet</p>
                            <p className="text-sm">Add IP addresses to allow users to access from specific locations</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Added By</TableHead>
                                    <TableHead>Added At</TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {whitelist.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono">{entry.ip}</TableCell>
                                        <TableCell>{entry.username}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{entry.label}</Badge>
                                        </TableCell>
                                        <TableCell>{entry.addedBy}</TableCell>
                                        <TableCell>{new Date(entry.addedAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Remove IP?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will remove <strong>{entry.ip}</strong> from the whitelist immediately across all devices. {entry.username} will be blocked when accessing from this IP.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemoveIP(entry.id)}>
                                                            Remove
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Quick Add Current IP */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Add Current IP</CardTitle>
                    <CardDescription>
                        Quickly whitelist your current IP ({currentIP || 'Loading...'}) for any user
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {users.slice(0, 10).map((user) => (
                            <Button
                                key={user.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddCurrentIP(user.id)}
                                disabled={!currentIP || whitelist.some(w => {
                                    if (w.ip !== currentIP) return false;
                                    const storedId = String(w.userId);
                                    const uid = String(user.id);
                                    // Support both old "42" and new "siteId_42" formats
                                    const wpIdFromStored = storedId.includes('_')
                                        ? storedId.split('_').pop() ?? storedId
                                        : storedId;
                                    return wpIdFromStored === uid || storedId === uid;
                                })}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                {user.username}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Activity Logs */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            IP Activity Logs
                        </CardTitle>
                        <CardDescription>
                            Recent IP-related security events — fetched from WordPress, all sites and devices included
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                        {loadingLogs
                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1">Refresh</span>
                    </Button>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No IP activity logs yet</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-auto">
                            {logs.slice(0, 50).map((log, index) => (
                                <div
                                    key={log.id || index}
                                    className={`p-3 rounded-lg border text-sm ${isAlertLog(log)
                                        ? 'border-destructive/50 bg-destructive/5'
                                        : isWarningLog(log)
                                            ? 'border-amber-300/50 bg-amber-50/50'
                                            : 'border-border bg-muted/30'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={
                                                isAlertLog(log) ? 'destructive'
                                                    : isWarningLog(log) ? 'outline'
                                                        : 'secondary'
                                            }>
                                                {log.action.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="font-medium">{getLogUsername(log)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-muted-foreground text-xs">
                                                {getLogTimestamp(log)
                                                    ? new Date(getLogTimestamp(log)).toLocaleString()
                                                    : '—'}
                                            </span>
                                            {isWarningLog(log) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-[10px]"
                                                    onClick={() => handleApproveRequest(log)}
                                                >
                                                    Approve
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {getLogIP(log) && (
                                        <div className="mt-1 text-muted-foreground font-mono text-xs">
                                            IP: {getLogIP(log)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
