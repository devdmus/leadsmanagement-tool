import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';

interface IPSessionData {
    ip: string;
    userId: string;
    loginTime: string;
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

const IP_WHITELIST_KEY = 'crm_ip_whitelist';

export function IPSecurityGuard({ children }: { children: React.ReactNode }) {
    const { profile, signOut } = useAuth();
    const [isValidating, setIsValidating] = useState(true);
    const [ipMismatch, setIpMismatch] = useState(false);
    const [currentIP, setCurrentIP] = useState<string | null>(null);
    const [loginIP, setLoginIP] = useState<string | null>(null);

    useEffect(() => {
        const validateSession = async () => {
            if (!profile) {
                setIsValidating(false);
                return;
            }

            try {
                // Get stored session IP
                const storedData = localStorage.getItem('crm_session_ip');
                if (!storedData) {
                    // No IP stored, allow access (legacy session)
                    setIsValidating(false);
                    return;
                }

                const sessionData: IPSessionData = JSON.parse(storedData);
                setLoginIP(sessionData.ip);

                // Check if session belongs to current user
                if (sessionData.userId !== profile.id) {
                    // Different user, allow new session
                    setIsValidating(false);
                    return;
                }

                // Get current IP
                const response = await fetch('https://api.ipify.org?format=json');
                if (!response.ok) {
                    // Can't verify, allow access
                    setIsValidating(false);
                    return;
                }

                const ipData = await response.json();
                setCurrentIP(ipData.ip);

                // If IP matches login IP, allow
                if (sessionData.ip === ipData.ip) {
                    setIsValidating(false);
                    return;
                }

                // Check if current IP is in whitelist for this user
                const whitelistData = localStorage.getItem(IP_WHITELIST_KEY);
                if (whitelistData) {
                    const whitelist: WhitelistedIP[] = JSON.parse(whitelistData);
                    const isWhitelisted = whitelist.some(
                        (entry) => entry.ip === ipData.ip && entry.userId === profile.id
                    );

                    if (isWhitelisted) {
                        // IP is whitelisted, update session and allow
                        const newSessionData = {
                            ip: ipData.ip,
                            userId: profile.id,
                            loginTime: new Date().toISOString(),
                        };
                        localStorage.setItem('crm_session_ip', JSON.stringify(newSessionData));

                        // Log the whitelisted access
                        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
                        logs.unshift({
                            action: 'whitelisted_access',
                            ip: ipData.ip,
                            userId: profile.id,
                            username: profile.username,
                            timestamp: new Date().toISOString(),
                        });
                        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));

                        setIsValidating(false);
                        return;
                    }
                }

                // IP mismatch and not whitelisted
                setIpMismatch(true);

                // Log the suspicious activity
                const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
                logs.unshift({
                    action: 'ip_mismatch',
                    loginIP: sessionData.ip,
                    currentIP: ipData.ip,
                    userId: profile.id,
                    username: profile.username,
                    timestamp: new Date().toISOString(),
                });
                localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
            } catch (error) {
                console.warn('IP validation error:', error);
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

    const handleContinue = () => {
        // Update the session IP to current IP (user confirmed it's them)
        if (currentIP && profile) {
            const sessionData = {
                ip: currentIP,
                userId: profile.id,
                loginTime: new Date().toISOString(),
            };
            localStorage.setItem('crm_session_ip', JSON.stringify(sessionData));

            // Log the IP update
            const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
            logs.unshift({
                action: 'ip_updated',
                oldIP: loginIP,
                newIP: currentIP,
                userId: profile.id,
                username: profile.username,
                timestamp: new Date().toISOString(),
            });
            localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
        }
        setIpMismatch(false);
    };

    const handleAddToWhitelist = () => {
        if (!currentIP || !profile) return;

        // Add current IP to whitelist
        const whitelistData = localStorage.getItem(IP_WHITELIST_KEY);
        const whitelist: WhitelistedIP[] = whitelistData ? JSON.parse(whitelistData) : [];

        const newEntry: WhitelistedIP = {
            id: Math.random().toString(36).substr(2, 9),
            ip: currentIP,
            userId: String(profile.id),
            username: String(profile.username),
            label: 'Self-Added',
            addedBy: String(profile.username),
            addedAt: new Date().toISOString(),
        };

        whitelist.push(newEntry);
        localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist));

        // Update session
        const sessionData = {
            ip: currentIP,
            userId: profile.id,
            loginTime: new Date().toISOString(),
        };
        localStorage.setItem('crm_session_ip', JSON.stringify(sessionData));

        // Log
        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({
            action: 'ip_self_whitelisted',
            ip: currentIP,
            userId: profile.id,
            username: profile.username,
            timestamp: new Date().toISOString(),
        });
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));

        setIpMismatch(false);
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

    if (ipMismatch) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full border-destructive">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle className="text-destructive">Security Alert</CardTitle>
                        <CardDescription>
                            Your IP address has changed since login
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Login IP:</span>
                                <span className="font-mono">{loginIP}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current IP:</span>
                                <span className="font-mono text-destructive">{currentIP}</span>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground text-center">
                            For your security, please confirm this is you or log in again.
                        </p>

                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleContinue}
                                >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Continue Once
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={handleLogout}
                                >
                                    Log Out
                                </Button>
                            </div>
                            <Button
                                variant="default"
                                className="w-full"
                                onClick={handleAddToWhitelist}
                            >
                                <Shield className="mr-2 h-4 w-4" />
                                Trust This IP (Add to Whitelist)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
}
