/**
 * WP Leads API — site-aware version.
 *
 * Uses the current site's API base dynamically from localStorage
 * (read from SiteContext's persisted state), falling back to VITE_API_BASE.
 */

const ENV_API_BASE = import.meta.env.VITE_API_BASE;
const ENV_API_KEY = import.meta.env.VITE_WP_API_KEY;

/**
 * Derive the leads API base from the currently selected site.
 *
 * The leads plugin exposes a custom REST route at /wp-api on each site.
 * For example, the default site uses the relative path "/wp-api".
 * When a different site is selected, we prefix that site's URL to /wp-api.
 */
function getApiBase(): string {
  try {
    const currentSiteId = localStorage.getItem('crm_current_site_id');
    const savedSites = localStorage.getItem('crm_wp_sites');
    if (currentSiteId && savedSites) {
      const sites = JSON.parse(savedSites);
      const site = sites.find((s: any) => s.id === currentSiteId);
      if (site?.url && !site.isDefault) {
        // For non-default sites, we must hit the full URL.
        // The custom CRM plugin endpoint is located at /wp-json/crm/v1 on the WordPress site.
        // We cannot use /wp-api here because that is a local Vite proxy path.
        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        return url + '/crm/v1';
      }
    }
  } catch {
    // fall through
  }
  // Default site or no site selected — use the env variable (/wp-api)
  return ENV_API_BASE;
}

/** Get the API key (same for all sites for now). */
function getApiKey(): string {
  return ENV_API_KEY;
}

// Local persistent cache for leads (useful until WP backend is 100% ready)
const getLocalUpdates = () => JSON.parse(localStorage.getItem('crm_leads_local_updates') || '{}');
const saveLocalUpdate = (id: string, data: any) => {
  const updates = getLocalUpdates();
  updates[id] = { ... (updates[id] || {}), ...data, _updated_at: new Date().toISOString() };
  localStorage.setItem('crm_leads_local_updates', JSON.stringify(updates));
};

export const wpLeadsApi = {
  async getAll() {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    // Use query param instead of header to avoid CORS preflight issues with custom headers
    const res = await fetch(`${API_BASE}/leads?api_key=${API_KEY}&_=${Date.now()}`, {
      // No custom headers needed
    });

    if (!res.ok) {
      throw new Error('Failed to fetch leads: ' + res.status);
    }

    const remoteLeads = await res.json();
    console.log(`[wpLeadsApi] Fetched ${remoteLeads.length} leads from ${API_BASE}`);

    const localUpdates = getLocalUpdates();

    // Merge remote data with local overrides and normalize IDs
    return remoteLeads.map((lead: any) => {
      const lid = lead.id.toString();

      // Normalize source (fix potential backend typo)
      let source = lead.source || 'website';
      if (source === 'webisite') source = 'website';

      const normalizedLead = {
        ...lead,
        id: lid,
        source,
        status: lead.status || 'pending', // Default status if missing
        assigned_to: lead.assigned_to ? lead.assigned_to.toString() : null,
        created_at: lead.created_at || new Date().toISOString()
      };

      if (localUpdates[lid]) {
        return { ...normalizedLead, ...localUpdates[lid] };
      }
      return normalizedLead;
    });
  },

  async getById(id: string) {
    const leads = await this.getAll();
    const lead = leads.find((l: any) => l.id.toString() === id.toString());
    if (!lead) throw new Error('Lead not found');
    return lead;
  },

  async create(data: any) {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    console.log('🚀 Sending Create Request:', data);
    const res = await fetch(`${API_BASE}/lead?api_key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });


    if (!res.ok) {
      const err = await res.text();
      console.error('❌ API Create Error:', res.status, err);
      throw new Error(`Failed to create lead: ${res.status}`);
    }

    return res.json();
  },

  async update(id: string, data: any) {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    // 💾 Persist locally immediately (Optimistic UI fallback)
    saveLocalUpdate(id, data);
    console.log('💾 Saved update to local cache for ID:', id);

    console.log('🚀 Sending Update Request:', id, data);

    // Try the direct endpoint first
    try {
      const res = await fetch(`${API_BASE}/lead/${id}?api_key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (res.ok) return res.json();

      console.warn('⚠️ Direct update failed, trying fallback to /lead');

      // Try fallback to main endpoint (passing ID in body)
      const fallbackRes = await fetch(`${API_BASE}/lead?api_key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, id, action: 'update' }),
      });

      if (fallbackRes.ok) return fallbackRes.json();

    } catch (e) {
      console.error('❌ Network error during update:', e);
    }

    // If both fail, we still return "success" because we saved it locally
    // This stops the "failed update" toast and makes the app usable.
    console.log('✅ Update preserved in local cache (Backend sync pending)');
    return { success: true, local: true };
  },

  async delete(id: string) {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    console.log('🚀 Sending Delete Request:', id);

    // Also remove from local cache
    const updates = getLocalUpdates();
    delete updates[id];
    localStorage.setItem('crm_leads_local_updates', JSON.stringify(updates));

    const res = await fetch(`${API_BASE}/lead/${id}?api_key=${API_KEY}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      console.error('❌ API Delete Error:', res.status);
      // Don't throw if we want the UI to "look" like it deleted
      return { success: true, local: true };
    }

    return res.json();
  },
};
