/**
 * siteCache.ts
 *
 * A lightweight in-memory cache that SiteContext populates after it loads
 * sites from the MySQL database.  Legacy helper modules (wordpressApi,
 * wpLeadsApi, wpConfig, …) read from this cache instead of localStorage,
 * so the rest of the app still works without needing React context.
 */

export type CachedSite = {
    id: string;
    name: string;
    url: string;
    username?: string;
    appPassword?: string;
    isDefault?: boolean;
    assignedAdmins?: string[];
};

// ── Synchronous Initialization from localStorage ────────────────
const SAVED_SITES_KEY = 'crm_wp_sites';
const CURRENT_SITE_KEY = 'crm_current_site_id';

let _sites: CachedSite[] = [];
let _currentSiteId: string | null = null;

try {
    const savedSites = localStorage.getItem(SAVED_SITES_KEY);
    if (savedSites) {
        _sites = JSON.parse(savedSites);
    }
    _currentSiteId = localStorage.getItem(CURRENT_SITE_KEY);
} catch (e) {
    console.warn('[siteCache] Failed to initialize from localStorage:', e);
}

/** Called by SiteContext whenever sites are fetched from the DB. */
export function setSiteCache(sites: CachedSite[], currentSiteId: string | null) {
    _sites = sites;
    _currentSiteId = currentSiteId;
}

/** Returns the currently selected site, or the first available one. */
export function getCurrentSiteFromCache(): CachedSite | null {
    if (_sites.length === 0) return null;
    if (_currentSiteId) {
        return _sites.find(s => s.id === _currentSiteId) ?? _sites[0];
    }
    return _sites[0];
}

/** Returns all cached sites. */
export function getAllSitesFromCache(): CachedSite[] {
    return _sites;
}
