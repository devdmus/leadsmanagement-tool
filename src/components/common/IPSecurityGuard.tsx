import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, RefreshCw } from 'lucide-react';

interface WhitelistedIP {
    id: string;
    ip: string;
    userId: string;
    username: string;
    label: string;
    addedBy: string;
    addedAt: string;
}

const IP_WHITELIST_KEY = 'crm_ip_whitelist';
const ALLOWED_PRIMARY_IP = '183.82.116.22';

export function IPSecurityGuard({ children }: { children: React.ReactNode }) {
    const { profile, signOut } = useAuth();
    const [isValidating, setIsValidating] = useState(true);
    const [accessRestricted, setAccessRestricted] = useState(false);
    const [currentIP, setCurrentIP] = useState<string | null>(null);
    const [requestSent, setRequestSent] = useState(false);

    useEffect(() => {
        const validateSession = async () => {
            if (!profile) {
                setIsValidating(false);
                return;
            }

            try {
                // Get current IP
                const response = await fetch('https://api.ipify.org?format=json');
                if (!response.ok) {
                    // If we can't get IP, we must block for safety in this strict mode
                    setAccessRestricted(true);
                    setIsValidating(false);
                    return;
                }

                const ipData = await response.json();
                setCurrentIP(ipData.ip);

                // 1. Check if it's the primary allowed IP
                if (ipData.ip === ALLOWED_PRIMARY_IP) {
                    setIsValidating(false);
                    return;
                }

                // 2. Check if IP is in whitelist for this user
                const whitelistData = localStorage.getItem(IP_WHITELIST_KEY);
                if (whitelistData) {
                    const whitelist: WhitelistedIP[] = JSON.parse(whitelistData);
                    const isWhitelisted = whitelist.some(
                        (entry) => entry.ip === ipData.ip && entry.userId === profile.id
                    );

                    if (isWhitelisted) {
                        setIsValidating(false);
                        return;
                    }
                }

                // If we reach here, the IP is NOT authorized
                setAccessRestricted(true);

                // Log the unauthorized access attempt
                const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
                logs.unshift({
                    action: 'unauthorized_attempt',
                    ip: ipData.ip,
                    userId: profile.id,
                    username: profile.username,
                    timestamp: new Date().toISOString(),
                });
                localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
            } catch (error) {
                console.warn('IP validation error:', error);
                setAccessRestricted(true);
            }

            setIsValidating(false);
        };

        validateSession();
    }, [profile]);

    const handleLogout = async () => {
        localStorage.removeItem('crm_session_ip');
        await signOut();
        window.location.href = '/login';
    };

    const handleRequestPermission = () => {
        if (!currentIP || !profile) return;

        // Log the permission request
        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({
            action: 'permission_requested',
            ip: currentIP,
            userId: profile.id,
            username: profile.username,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));

        setRequestSent(true);
    };

    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Verifying session security...</span>
                </div>
            </div>
        );
    }

    if (accessRestricted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full border-destructive shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
                            <Shield className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle className="text-destructive text-2xl">Restricted Access</CardTitle>
                        <CardDescription>
                            Your current IP address is not authorized to access this system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Your IP:</span>
                                <span className="font-mono font-bold text-destructive">{currentIP || 'Unknown'}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest text-center pt-2">
                                Security Protocol Active
                            </div>
                        </div>

                        {requestSent ? (
                            <div className="bg-success/10 border border-success/20 p-4 rounded-lg text-center">
                                <p className="text-success font-medium text-sm">
                                    Permission request sent!
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    An administrator will review your access request shortly.
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">
                                Only authorized locations can access the CRM. If this is a mistake, please request permission.
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            {!requestSent && (
                                <Button
                                    variant="default"
                                    className="w-full h-11 bg-primary hover:bg-primary/90 transition-all shadow-md"
                                    onClick={handleRequestPermission}
                                >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Request Permission
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="w-full h-11 border-destructive/20 hover:bg-destructive/5 text-destructive"
                                onClick={handleLogout}
                            >
                                Log Out
                            </Button>
                        </div>

                        <div className="text-center">
                            <p className="text-[10px] text-muted-foreground italic">
                                Support ID: {profile?.id?.substring(0, 8) || 'anonymous'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
}
