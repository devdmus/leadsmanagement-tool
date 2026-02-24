import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, RefreshCw } from 'lucide-react';
import { createWordPressApi } from '@/db/wordpressApi';
import { getCurrentSiteFromCache } from '@/utils/siteCache';

interface WhitelistedIP {
    id: string;
    ip: string;
    userId: string;
    username: string;
    label: string;
    addedBy: string;
    addedAt: string;
}

const ALLOWED_PRIMARY_IP = '183.82.116.22';

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

export function IPSecurityGuard({ children }: { children: React.ReactNode }) {
    const { profile, signOut, getWpAuthHeader } = useAuth();
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

            // Super admin always has full access — skip IP validation
            if (profile.role === 'super_admin') {
                setIsValidating(false);
                return;
            }

            try {
                // Get current public IP
                const response = await fetch('https://api.ipify.org?format=json');
                if (!response.ok) {
                    // Cannot verify IP — block for safety
                    setAccessRestricted(true);
                    setIsValidating(false);
                    return;
                }

                const ipData = await response.json();
                setCurrentIP(ipData.ip);

                // 1. Hardcoded primary IP always allowed
                if (ipData.ip === ALLOWED_PRIMARY_IP) {
                    setIsValidating(false);
                    return;
                }

                // 2. Fetch whitelist from WordPress (shared, cross-device)
                // Uses the current site's wp-json endpoint
                try {
                    const wpJsonBase = getCurrentWpJsonBase();
                    if (!wpJsonBase) {
                        // No site configured — skip remote whitelist check
                        throw new Error('No site configured');
                    }

                    const authHeader = getWpAuthHeader();
                    const api = createWordPressApi(wpJsonBase, { Authorization: authHeader });
                    const whitelist: WhitelistedIP[] = await api.getIPWhitelist();

                    const isWhitelisted = Array.isArray(whitelist) && whitelist.some((entry) => {
                        if (entry.ip !== ipData.ip) return false;
                        const storedUserId = String(entry.userId);
                        const profileId = String(profile.id);
                        // Support both old format ("42") and new composite format ("siteId_42")
                        // Extract just the WP user ID from composite "siteId_wpUserId"
                        const wpIdFromStored = storedUserId.includes('_')
                            ? storedUserId.split('_').pop() ?? storedUserId
                            : storedUserId;
                        return wpIdFromStored === profileId || storedUserId === profileId;
                    });

                    if (isWhitelisted) {
                        setIsValidating(false);
                        return;
                    }
                } catch (whitelistErr) {
                    // If WordPress endpoint not yet installed, fall back to localStorage whitelist
                    // so existing users aren't immediately locked out
                    console.warn('WordPress IP whitelist endpoint not available, falling back to localStorage:', whitelistErr);
                    const whitelistData = localStorage.getItem('crm_ip_whitelist');
                    if (whitelistData) {
                        try {
                            const localWhitelist: WhitelistedIP[] = JSON.parse(whitelistData);
                            const isWhitelisted = localWhitelist.some(
                                (entry) => entry.ip === ipData.ip && String(entry.userId) === String(profile.id)
                            );
                            if (isWhitelisted) {
                                setIsValidating(false);
                                return;
                            }
                        } catch (_) { }
                    }
                }

                // Not authorized — log the attempt to WordPress
                setAccessRestricted(true);
                try {
                    const authHeader = getWpAuthHeader();
                    const api = createWordPressApi(getCurrentWpJsonBase(), { Authorization: authHeader });
                    await api.logActivity(
                        'unauthorized_attempt',
                        `Blocked login attempt from IP ${ipData.ip} for user ${profile.username}`
                    );
                } catch (_) {
                    // Fallback: log locally if WordPress unavailable
                    const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
                    logs.unshift({
                        action: 'unauthorized_attempt',
                        ip: ipData.ip,
                        userId: profile.id,
                        username: profile.username,
                        timestamp: new Date().toISOString(),
                    });
                    localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
                }

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

    const handleRequestPermission = async () => {
        if (!currentIP || !profile) return;

        try {
            const authHeader = getWpAuthHeader();
            const api = createWordPressApi(getCurrentWpJsonBase(), { Authorization: authHeader });
            await api.logActivity(
                'permission_requested',
                `User ${profile.username} (ID: ${profile.id}) is requesting access from IP ${currentIP}`
            );
        } catch (_) {
            // Fallback: log locally
            const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
            logs.unshift({
                action: 'permission_requested',
                ip: currentIP,
                userId: profile.id,
                username: profile.username,
                timestamp: new Date().toISOString(),
                status: 'pending',
            });
            localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
        }

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
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                                <p className="text-green-700 font-medium text-sm">
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
