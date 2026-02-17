// IP Security Service
// Tracks user login IP and validates session based on IP

const IP_SESSION_KEY = 'crm_session_ip';
const IP_API_URL = 'https://api.ipify.org?format=json';

export const ipSecurityService = {
    // Get the current user's public IP address
    async getCurrentIP(): Promise<string | null> {
        try {
            const response = await fetch(IP_API_URL);
            if (response.ok) {
                const data = await response.json();
                return data.ip;
            }
        } catch (error) {
            console.warn('Failed to get IP address:', error);
        }
        return null;
    },

    // Store the login IP address
    saveLoginIP(ip: string, userId: string): void {
        const sessionData = {
            ip,
            userId,
            loginTime: new Date().toISOString(),
        };
        localStorage.setItem(IP_SESSION_KEY, JSON.stringify(sessionData));
    },

    // Get the stored login IP
    getLoginIP(): { ip: string; userId: string; loginTime: string } | null {
        const data = localStorage.getItem(IP_SESSION_KEY);
        if (data) {
            try {
                return JSON.parse(data);
            } catch {
                return null;
            }
        }
        return null;
    },

    // Clear the IP session (on logout)
    clearIPSession(): void {
        localStorage.removeItem(IP_SESSION_KEY);
    },

    // Validate if current IP matches login IP
    async validateIPSession(): Promise<{ valid: boolean; currentIP: string | null; loginIP: string | null; mismatch: boolean }> {
        const storedSession = this.getLoginIP();
        const currentIP = await this.getCurrentIP();

        if (!storedSession) {
            return { valid: true, currentIP, loginIP: null, mismatch: false };
        }

        if (!currentIP) {
            // Can't verify IP, allow access but log warning
            console.warn('Unable to verify IP address');
            return { valid: true, currentIP: null, loginIP: storedSession.ip, mismatch: false };
        }

        const ipMatches = storedSession.ip === currentIP;

        return {
            valid: ipMatches,
            currentIP,
            loginIP: storedSession.ip,
            mismatch: !ipMatches,
        };
    },

    // Log IP activity (for audit)
    logIPActivity(action: string, ip: string, userId: string): void {
        const logs = JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
        logs.unshift({
            action,
            ip,
            userId,
            timestamp: new Date().toISOString(),
        });
        // Keep only last 100 logs
        localStorage.setItem('crm_ip_logs', JSON.stringify(logs.slice(0, 100)));
    },

    // Get IP activity logs
    getIPLogs(): Array<{ action: string; ip: string; userId: string; timestamp: string }> {
        return JSON.parse(localStorage.getItem('crm_ip_logs') || '[]');
    },
};
