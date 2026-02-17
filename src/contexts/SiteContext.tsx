import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type WordPressSite = {
    id: string;
    name: string;
    url: string;
    username?: string;
    appPassword?: string;
    isDefault?: boolean;
    assignedAdmins?: string[]; // List of admin user IDs who can access this site
    createdAt: string;
};

type SiteContextType = {
    sites: WordPressSite[];
    currentSite: WordPressSite | null;
    addSite: (site: Omit<WordPressSite, 'id' | 'createdAt'>) => WordPressSite;
    updateSite: (id: string, updates: Partial<WordPressSite>) => void;
    deleteSite: (id: string) => void;
    setCurrentSite: (siteId: string) => void;
    getApiBase: () => string;
    getAuthHeader: () => string | null;
    getAccessibleSites: (userId: string, userRole: string) => WordPressSite[];
    assignAdminToSite: (siteId: string, adminId: string) => void;
    removeAdminFromSite: (siteId: string, adminId: string) => void;
};

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const SITES_KEY = 'crm_wp_sites';
const CURRENT_SITE_KEY = 'crm_current_site_id';

const genId = () => Math.random().toString(36).substr(2, 9);

// Default site configuration
const DEFAULT_SITE: WordPressSite = {
    id: 'default',
    name: 'Bhairavi Healthcare',
    url: 'https://digitmarketus.com/Bhairavi',
    isDefault: true,
    assignedAdmins: [],
    createdAt: new Date().toISOString(),
};

export function SiteProvider({ children }: { children: ReactNode }) {
    const [sites, setSites] = useState<WordPressSite[]>([]);
    const [currentSite, setCurrentSiteState] = useState<WordPressSite | null>(null);

    // Load sites from localStorage on mount
    useEffect(() => {
        const savedSites = localStorage.getItem(SITES_KEY);
        const savedCurrentId = localStorage.getItem(CURRENT_SITE_KEY);

        let loadedSites: WordPressSite[] = [];

        if (savedSites) {
            loadedSites = JSON.parse(savedSites);
        }

        // Ensure default site exists
        if (!loadedSites.find(s => s.id === 'default')) {
            loadedSites = [DEFAULT_SITE, ...loadedSites];
        }

        setSites(loadedSites);

        // Set current site
        if (savedCurrentId) {
            const found = loadedSites.find(s => s.id === savedCurrentId);
            setCurrentSiteState(found || loadedSites[0]);
        } else {
            setCurrentSiteState(loadedSites[0]);
        }
    }, []);

    // Save sites to localStorage whenever they change
    useEffect(() => {
        if (sites.length > 0) {
            localStorage.setItem(SITES_KEY, JSON.stringify(sites));
        }
    }, [sites]);

    const addSite = (siteData: Omit<WordPressSite, 'id' | 'createdAt'>): WordPressSite => {
        const newSite: WordPressSite = {
            ...siteData,
            id: genId(),
            assignedAdmins: siteData.assignedAdmins || [],
            createdAt: new Date().toISOString(),
        };
        setSites(prev => [...prev, newSite]);
        return newSite;
    };

    const updateSite = (id: string, updates: Partial<WordPressSite>) => {
        setSites(prev => prev.map(site =>
            site.id === id ? { ...site, ...updates } : site
        ));

        // Update current site if it was updated
        if (currentSite?.id === id) {
            setCurrentSiteState(prev => prev ? { ...prev, ...updates } : prev);
        }
    };

    const deleteSite = (id: string) => {
        // Can't delete default site
        if (id === 'default') return;

        setSites(prev => prev.filter(site => site.id !== id));

        // If deleted site was current, switch to default
        if (currentSite?.id === id) {
            const defaultSite = sites.find(s => s.id === 'default') || sites[0];
            setCurrentSiteState(defaultSite);
            localStorage.setItem(CURRENT_SITE_KEY, defaultSite.id);
        }
    };

    const setCurrentSite = (siteId: string) => {
        const site = sites.find(s => s.id === siteId);
        if (site) {
            setCurrentSiteState(site);
            localStorage.setItem(CURRENT_SITE_KEY, siteId);
        }
    };

    const getApiBase = (): string => {
        if (!currentSite) return 'https://digitmarketus.com/Bhairavi/wp-json';

        let url = currentSite.url;
        // Remove trailing slash
        url = url.replace(/\/$/, '');
        // Add wp-json if not present
        if (!url.includes('/wp-json')) {
            url = `${url}/wp-json`;
        }
        return url;
    };

    const getAuthHeader = (): string | null => {
        // First check current site credentials
        if (currentSite?.username && currentSite?.appPassword) {
            return 'Basic ' + btoa(`${currentSite.username}:${currentSite.appPassword}`);
        }

        // Fallback to global credentials
        const savedCreds = localStorage.getItem('wp_credentials');
        if (savedCreds) {
            const creds = JSON.parse(savedCreds);
            return 'Basic ' + btoa(`${creds.username}:${creds.password}`);
        }

        return null;
    };

    // Get sites accessible to a user based on their role
    const getAccessibleSites = (userId: string, userRole: string): WordPressSite[] => {
        // Super admin sees all sites
        if (userRole === 'super_admin') {
            return sites;
        }

        // Admin sees only sites they are assigned to
        if (userRole === 'admin') {
            return sites.filter(site =>
                site.assignedAdmins?.includes(userId) || site.isDefault
            );
        }

        // Other users see only the current site (their assigned site)
        // In a more complex setup, you'd have user-to-site assignments
        return currentSite ? [currentSite] : [];
    };

    // Assign an admin to a site
    const assignAdminToSite = (siteId: string, adminId: string) => {
        setSites(prev => prev.map(site => {
            if (site.id === siteId) {
                const currentAdmins = site.assignedAdmins || [];
                if (!currentAdmins.includes(adminId)) {
                    return { ...site, assignedAdmins: [...currentAdmins, adminId] };
                }
            }
            return site;
        }));
    };

    // Remove an admin from a site
    const removeAdminFromSite = (siteId: string, adminId: string) => {
        setSites(prev => prev.map(site => {
            if (site.id === siteId) {
                return {
                    ...site,
                    assignedAdmins: (site.assignedAdmins || []).filter(id => id !== adminId)
                };
            }
            return site;
        }));
    };

    return (
        <SiteContext.Provider value={{
            sites,
            currentSite,
            addSite,
            updateSite,
            deleteSite,
            setCurrentSite,
            getApiBase,
            getAuthHeader,
            getAccessibleSites,
            assignAdminToSite,
            removeAdminFromSite,
        }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const context = useContext(SiteContext);
    if (!context) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
}
