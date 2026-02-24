import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setSiteCache } from '@/utils/siteCache';


export type WordPressSite = {
    id: string;
    name: string;
    url: string;
    username?: string;
    appPassword?: string;
    isDefault?: boolean;
    assignedAdmins?: string[];
    createdAt: string;
};

type SiteContextType = {
    sites: WordPressSite[];
    currentSite: WordPressSite | null;
    addSite: (site: Omit<WordPressSite, 'id' | 'createdAt'>) => Promise<WordPressSite>;
    updateSite: (id: string, updates: Partial<WordPressSite>) => Promise<void>;
    deleteSite: (id: string) => Promise<void>;
    setCurrentSite: (siteId: string) => void;
    getApiBase: () => string;
    getAuthHeader: () => string | null;
    getAccessibleSites: (userId: string, userRole: string) => WordPressSite[];
    canSwitchSites: (userId: string, userRole: string) => boolean;
    assignAdminToSite: (siteId: string, adminId: string) => Promise<void>;
    removeAdminFromSite: (siteId: string, adminId: string) => Promise<void>;
};

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const CURRENT_SITE_KEY = 'crm_current_site_id';
const API_BASE = 'http://localhost:3001/api/sites';

const genId = () => Math.random().toString(36).substr(2, 9);

/** Map snake_case DB row to camelCase WordPressSite */
function mapRow(row: any): WordPressSite {
    return {
        id: row.id,
        name: row.name,
        url: row.url,
        username: row.username ?? undefined,
        appPassword: row.app_password ?? undefined,
        isDefault: Boolean(row.is_default),
        assignedAdmins: row.assignedAdmins ?? [],
        createdAt: row.created_at ?? new Date().toISOString(),
    };
}

export function SiteProvider({ children }: { children: ReactNode }) {
    const [sites, setSites] = useState<WordPressSite[]>([]);
    const [currentSite, setCurrentSiteState] = useState<WordPressSite | null>(null);

    // ── Sync siteCache whenever sites or currentSite changes ────────────────
    useEffect(() => {
        setSiteCache(sites, currentSite?.id ?? null);
    }, [sites, currentSite]);

    // ── Load sites from DB on mount ──────────────────────────────────────────
    useEffect(() => {
        fetch(API_BASE)
            .then(res => res.json())
            .then((data: any[]) => {
                const loadedSites = data.map(mapRow);
                setSites(loadedSites);

                // Restore last active site from localStorage (just the ID)
                const savedCurrentId = localStorage.getItem(CURRENT_SITE_KEY);
                const activeSite = savedCurrentId
                    ? (loadedSites.find(s => s.id === savedCurrentId) ?? loadedSites[0] ?? null)
                    : (loadedSites[0] ?? null);
                setCurrentSiteState(activeSite);
            })
            .catch(err => {
                console.warn('Failed to load sites from DB, falling back to localStorage', err);
                // Fallback: try localStorage if server is not reachable
                const saved = localStorage.getItem('crm_wp_sites');
                if (saved) {
                    const loadedSites: WordPressSite[] = JSON.parse(saved);
                    setSites(loadedSites);
                    const savedCurrentId = localStorage.getItem(CURRENT_SITE_KEY);
                    const activeSite = savedCurrentId
                        ? (loadedSites.find(s => s.id === savedCurrentId) ?? loadedSites[0] ?? null)
                        : (loadedSites[0] ?? null);
                    setCurrentSiteState(activeSite);
                }
            });
    }, []);

    // ── CRUD operations ──────────────────────────────────────────────────────

    const addSite = async (siteData: Omit<WordPressSite, 'id' | 'createdAt'>): Promise<WordPressSite> => {
        const newSite: WordPressSite = {
            ...siteData,
            id: genId(),
            assignedAdmins: siteData.assignedAdmins || [],
            createdAt: new Date().toISOString(),
        };

        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSite),
        });

        if (!res.ok) throw new Error('Failed to create site');
        const created = mapRow(await res.json());
        setSites(prev => [...prev, created]);
        return created;
    };

    const updateSite = async (id: string, updates: Partial<WordPressSite>): Promise<void> => {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error('Failed to update site');
        const updated = mapRow(await res.json());

        setSites(prev => prev.map(site => site.id === id ? updated : site));
        if (currentSite?.id === id) {
            setCurrentSiteState(updated);
        }
    };

    const deleteSite = async (id: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete site');

        setSites(prev => prev.filter(site => site.id !== id));

        if (currentSite?.id === id) {
            const remaining = sites.filter(s => s.id !== id);
            const nextSite = remaining[0] || null;
            setCurrentSiteState(nextSite);
            if (nextSite) {
                localStorage.setItem(CURRENT_SITE_KEY, nextSite.id);
            } else {
                localStorage.removeItem(CURRENT_SITE_KEY);
            }
        }
    };

    const setCurrentSite = (siteId: string) => {
        const site = sites.find(s => s.id === siteId);
        if (site) {
            // Sync siteCache immediately so child useEffects see the new site
            // when they fire (before the parent useEffect would run)
            setSiteCache(sites, siteId);
            setCurrentSiteState(site);
            localStorage.setItem(CURRENT_SITE_KEY, siteId);
        }
    };

    const getApiBase = (): string => {
        if (!currentSite) return '';
        let url = currentSite.url;
        url = url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) {
            url = `${url}/wp-json`;
        }
        return url;
    };

    const getAuthHeader = (): string | null => {
        if (currentSite?.username && currentSite?.appPassword) {
            return 'Basic ' + btoa(`${currentSite.username}:${currentSite.appPassword}`);
        }

        const savedCreds = localStorage.getItem('wp_credentials');
        if (savedCreds) {
            const creds = JSON.parse(savedCreds);
            return 'Basic ' + btoa(`${creds.username}:${creds.password}`);
        }

        return null;
    };

    const getAccessibleSites = (userId: string, userRole: string): WordPressSite[] => {
        if (userRole === 'super_admin') return sites;

        // Filter sites where this user is assigned
        const assigned = sites.filter(s => (s.assignedAdmins || []).includes(userId));

        // Also always include the current site if it's not already in the list
        if (currentSite && !assigned.some(s => s.id === currentSite.id)) {
            return [currentSite, ...assigned];
        }

        return assigned;
    };

    const canSwitchSites = (userId: string, userRole: string): boolean => {
        if (userRole === 'super_admin') return true;
        return getAccessibleSites(userId, userRole).length > 1;
    };

    const assignAdminToSite = async (siteId: string, adminId: string): Promise<void> => {
        const site = sites.find(s => s.id === siteId);
        if (!site) return;
        const currentAdmins = site.assignedAdmins || [];
        if (currentAdmins.includes(adminId)) return;
        await updateSite(siteId, { assignedAdmins: [...currentAdmins, adminId] });
    };

    const removeAdminFromSite = async (siteId: string, adminId: string): Promise<void> => {
        const site = sites.find(s => s.id === siteId);
        if (!site) return;
        await updateSite(siteId, {
            assignedAdmins: (site.assignedAdmins || []).filter(id => id !== adminId),
        });
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
            canSwitchSites,
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
