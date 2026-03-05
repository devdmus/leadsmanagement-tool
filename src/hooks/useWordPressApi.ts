import { useMemo } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { createWordPressApi } from '@/db/wordpressApi';

/**
 * Returns a site-aware WordPress API instance.
 *
 * Every time the user switches sites via the SiteSwitcher dropdown,
 * the hook returns a new API object that points to the selected
 * WordPress site's REST endpoint.
 */
export function useWordPressApi() {
    const { currentSite, getApiBase, getAuthHeader } = useSite();

    const api = useMemo(() => {
        const baseUrl = getApiBase();
        const authHeaderValue = getAuthHeader();

        const authHeader: Record<string, string> = authHeaderValue
            ? { Authorization: authHeaderValue }
            : {
                Authorization:
                    'Basic ' + btoa('4ilwmh:syTRCaid5GHKm8xeWW1WeQ9X'),
            };

        return createWordPressApi(baseUrl, authHeader);
    }, [currentSite?.id]); // recalculate when the active site changes

    return api;
}
