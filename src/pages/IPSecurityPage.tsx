import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, Trash2, Shield, Globe, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { profilesApi } from '@/db/api';

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
    action: string;
    ip?: string;
    loginIP?: string;
    currentIP?: string;
    oldIP?: string;
    newIP?: string;
    userId: string;
    username?: string;
    timestamp: string;
}

const IP_WHITELIST_KEY = 'crm_ip_whitelist';

export default function IPSecurityPage() {
    const { profile } = useAuth();
    const { toast } = useToast();

    const [whitelist, setWhitelist] = useState<WhitelistedIP[]>([]);
    const [logs, setLogs] = useState<IPLog[]>([]);
    const [users, setUsers] = useState<Array<{ id: string; username: string }>>([]);
    const [currentIP, setCurrentIP] = useState<string | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        ip: '',
        userId: '',
        label: '',
    });

    // Load data
    useEffect(() => {
        // Load whitelist
        const savedWhitelist = localStorage.getItem(IP_WHITELIST_KEY);
        if (savedWhitelist) {
            setWhitelist(JSON.parse(savedWhitelist));
        }

        // Load logs
        const savedLogs = localStorage.getItem('crm_ip_logs');
        if (savedLogs) {
            setLogs(JSON.parse(savedLogs));
        }

        // Load users
        const loadUsers = async () => {
            const allUsers = await profilesApi.getAll();
            setUsers(allUsers.map((u: any) => ({ id: u.id, username: u.username })));
        };
        loadUsers();

        // Get current IP
        const fetchIP = async () => {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                if (res.ok) {
                    const data = await res.json();
                    setCurrentIP(data.ip);
                }
            } catch (e) {
                console.warn('Could not fetch IP');
            }
        };
        fetchIP();
    }, []);

    // Save whitelist
    const saveWhitelist = (newList: WhitelistedIP[]) => {
        setWhitelist(newList);
        localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(newList));
    };

    const handleAddIP = () => {
        if (!formData.ip || !formData.userId) {
            toast({
                title: 'Error',
                description: 'IP address and user are required',
                variant: 'destructive',
            });
            return;
        }

        // Validate IP format (basic)
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(formData.ip)) {
            toast({
                title: 'Invalid IP',
                description: 'Please enter a valid IP address (e.g., 192.168.1.1)',
                variant: 'destructive',
            });
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

        saveWhitelist([...whitelist, newEntry]);

        toast({
            title: 'IP Added',
            description: `${formData.ip} is now whitelisted for ${selectedUser?.username}`,
        });

        setFormData({ ip: '', userId: '', label: '' });
        setIsAddDialogOpen(false);
    };

    const handleRemoveIP = (id: string) => {
        const updated = whitelist.filter(w => w.id !== id);
        saveWhitelist(updated);
        toast({
            title: 'IP Removed',
            description: 'The IP address has been removed from whitelist',
        });
    };

    const handleAddCurrentIP = (userId: string) => {
        if (!currentIP) return;

        const selectedUser = users.find(u => u.id === userId);

        const newEntry: WhitelistedIP = {
            id: Math.random().toString(36).substr(2, 9),
            ip: currentIP,
            userId: userId,
            username: selectedUser?.username || 'Unknown',
            label: 'Current Device',
            addedBy: String(profile?.username || 'Admin'),
            addedAt: new Date().toISOString(),
        };

        saveWhitelist([...whitelist, newEntry]);

        toast({
            title: 'Current IP Added',
            description: `${currentIP} is now whitelisted for ${selectedUser?.username}`,
        });
    };

    const clearLogs = () => {
        localStorage.removeItem('crm_ip_logs');
        setLogs([]);
        toast({
            title: 'Logs Cleared',
            description: 'All IP activity logs have been cleared',
        });
    };

    // Check if current user can access this page
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">You don't have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        IP Security Settings
                    </h1>
                    <p className="text-muted-foreground">Manage allowed IP addresses for users</p>
                </div>
                <div className="flex gap-2">
                    {currentIP && (
                        <Badge variant="outline" className="text-sm py-2 px-3">
                            <Globe className="h-4 w-4 mr-2" />
                            Your IP: {currentIP}
                        </Badge>
                    )}
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
                                    Allow a specific IP address to access the system
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
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddIP}>Add IP</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Whitelist Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Whitelisted IP Addresses</CardTitle>
                    <CardDescription>
                        Users can access from these IP addresses without security alerts
                    </CardDescription>
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
                                                            This will remove {entry.ip} from the whitelist. The user will get security alerts when accessing from this IP.
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

            {/* Quick Add for Users */}
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
                                disabled={!currentIP || whitelist.some(w => w.ip === currentIP && w.userId === user.id)}
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
                            Recent IP-related security events
                        </CardDescription>
                    </div>
                    {logs.length > 0 && (
                        <Button variant="outline" size="sm" onClick={clearLogs}>
                            Clear Logs
                        </Button>
                    )}
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
                                    key={index}
                                    className={`p-3 rounded-lg border text-sm ${log.action === 'ip_mismatch'
                                        ? 'border-destructive/50 bg-destructive/5'
                                        : 'border-border bg-muted/30'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={log.action === 'ip_mismatch' ? 'destructive' : 'secondary'}>
                                                {log.action}
                                            </Badge>
                                            <span className="font-medium">{log.username || log.userId}</span>
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-muted-foreground font-mono text-xs">
                                        {log.ip && `IP: ${log.ip}`}
                                        {log.loginIP && log.currentIP && `Login: ${log.loginIP} → Current: ${log.currentIP}`}
                                        {log.oldIP && log.newIP && `${log.oldIP} → ${log.newIP}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
