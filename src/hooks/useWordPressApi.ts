import { useMemo } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { useAuth } from '@/contexts/AuthContext';
import { createWordPressApi } from '@/db/wordpressApi';

/**
 * Returns a site-aware WordPress API instance.
 *
 * Every time the user switches sites via the SiteSwitcher dropdown,
 * the hook returns a new API object that points to the selected
 * WordPress site's REST endpoint.
 *
 * Uses AuthContext's getWpAuthHeader() which checks:
 * 1. Per-site session credentials (user's own login)
 * 2. Site-level DB credentials (super admin fallback)
 * 3. Global WP credentials (fallback)
 */
export function useWordPressApi() {
    const { currentSite, getApiBase } = useSite();
    const { getWpAuthHeader } = useAuth();

    const api = useMemo(() => {
        const baseUrl = getApiBase();
        const authHeaderValue = getWpAuthHeader(currentSite?.id);

        const authHeader: Record<string, string> = authHeaderValue
            ? { Authorization: authHeaderValue }
            : {};

        return createWordPressApi(baseUrl, authHeader);
    }, [currentSite?.id]); // recalculate when the active site changes

    return api;
}
