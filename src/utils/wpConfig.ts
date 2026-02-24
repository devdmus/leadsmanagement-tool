import { getCurrentSiteFromCache } from '@/utils/siteCache';

export const getWpUrl = () => {
    // First try: current site from in-memory siteCache (populated by SiteContext)
    try {
        const site = getCurrentSiteFromCache();
        if (site?.url) {
            let url = site.url;
            if (!url.startsWith('http')) url = 'https://' + url;
            return url.replace(/\/$/, '');
        }
    } catch (_) { }

    // Fallback: old wp_site_url key
    const stored = localStorage.getItem('wp_site_url');
    if (stored) {
        let url = stored;
        if (!url.startsWith('http')) url = 'https://' + url;
        return url.replace(/\/$/, '');
    }

    // No site configured
    return '';
};

export const getWpRestUrl = () => {
    const base = getWpUrl();
    if (!base) return '';
    // Check if user already included wp-json
    if (base.includes('/wp-json')) return base;
    return `${base}/wp-json`;
};
