
export const getWpUrl = () => {
    const stored = localStorage.getItem('wp_site_url');
    const defaultUrl = 'https://digitmarketus.com/Bhairavi';

    let url = stored || defaultUrl;

    // Ensure protocol
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    // Remove trailing headers/slashes to cleaner base
    return url.replace(/\/$/, '');
};

export const getWpRestUrl = () => {
    const base = getWpUrl();
    // Check if user already included wp-json
    if (base.includes('/wp-json')) return base;
    return `${base}/wp-json`;
};
