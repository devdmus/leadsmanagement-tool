/**
 * WP Leads API — site-aware version.
 *
 * Reads the current site from the in-memory siteCache (populated by SiteContext
 * on load from DB), falling back to VITE_API_BASE env variable.
 */
import { getCurrentSiteFromCache } from '@/utils/siteCache';

const ENV_API_BASE = import.meta.env.VITE_API_BASE;
const ENV_API_KEY = import.meta.env.VITE_WP_API_KEY;

/**
 * Derive the leads API base from the currently selected site.
 */
function getApiBase(): string {
  try {
    const site = getCurrentSiteFromCache();
    if (site?.url) {
      let url = site.url.replace(/\/$/, '');
      if (!url.includes('/wp-json')) url += '/wp-json';
      const finalUrl = url + '/crm/v1';
      console.log(`📡 [wpLeadsApi] Using site API: ${finalUrl} (Site: ${site.name})`);
      return finalUrl;
    }
  } catch (e) {
    console.warn('[wpLeadsApi] Cache error:', e);
  }
  
  console.log(`🏠 [wpLeadsApi] Using fallback API: ${ENV_API_BASE}`);
  return ENV_API_BASE || '';
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
    const res = await fetch(`${API_BASE}/leads?api_key=${API_KEY}&_=${Date.now()}`).catch(err => {
      console.warn(`[wpLeadsApi] Network error for ${API_BASE}/leads:`, err.message);
      return null;
    });

    if (!res) {
      if (API_BASE === '/wp-api' || API_BASE === ENV_API_BASE) return [];
      throw new Error('Network error fetching leads');
    }

    const text = await res.text();
    if (!res.ok) {
      console.error(`[wpLeadsApi] Fetch failed (${res.status}). Response:`, text.substring(0, 500));
      // If 404 on the fallback path, just return empty instead of crashing
      if (res.status === 404 && (API_BASE === '/wp-api' || API_BASE === ENV_API_BASE)) {
        console.warn('[wpLeadsApi] 404 on local fallback. Returning empty array.');
        return [];
      }
      throw new Error(`Failed to fetch leads: ${res.status}`);
    }

    let remoteLeads;
    try {
      remoteLeads = JSON.parse(text);
    } catch (e: any) {
      console.log(`[wpLeadsApi] Error parsing JSON from ${API_BASE}/leads. RAW RESPONSE:`, text.substring(0, 500));
      // If we're using the fallback /wp-api and it's returning HTML (likely Vite SPA fallback),
      // just return an empty array instead of crashing the dashboard.
      if (API_BASE === '/wp-api' || API_BASE === ENV_API_BASE) {
        console.warn('[wpLeadsApi] JSON parse error on fallback. Returning empty array.');
        return [];
      }
      throw new Error(`Failed to parse leads JSON: ${e.message}`);
    }
    console.log(`[wpLeadsApi] Fetched ${remoteLeads.length} leads from ${API_BASE}`);

    const localUpdates = getLocalUpdates();
    let hasChanges = false;

    // Merge remote data with local overrides and normalize IDs
    const mergedLeads = remoteLeads.map((lead: any) => {
      const lid = lead.id.toString();

      // Normalize source (fix potential backend typo)
      let source = (lead.source || 'form').toLowerCase();
      if (source.includes('website') || source === 'webisite') source = 'form';
      if (source.includes('form')) source = 'form';

      const normalizedLead = {
        ...lead,
        id: lid,
        source,
        status: lead.status || 'pending', // Default status if missing
        assigned_to: lead.assigned_to ? lead.assigned_to.toString() : null,
        created_at: lead.created_at || new Date().toISOString(),
        notes: lead.notes || '',
        follow_up_date: lead.follow_up_date || null,
        follow_up_status: lead.follow_up_status || 'pending',
        follow_up_type: lead.follow_up_type || 'call'
      };

      // Sync Check: If server lead has newer updated_at than our local record, clear our local record
      if (localUpdates[lid]) {
        const localTime = new Date(localUpdates[lid]._updated_at).getTime();
        const remoteTime = new Date(lead.updated_at || 0).getTime();

        if (remoteTime >= localTime) {
          delete localUpdates[lid];
          hasChanges = true;
          return normalizedLead;
        }
        return { ...normalizedLead, ...localUpdates[lid] };
      }
      return normalizedLead;
    });

    if (hasChanges) {
      localStorage.setItem('crm_leads_local_updates', JSON.stringify(localUpdates));
    }

    return mergedLeads;
  },

  async getById(id: string) {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    try {
      const res = await fetch(`${API_BASE}/leads/${id}?api_key=${API_KEY}&_=${Date.now()}`);
      if (res.ok) {
        const lead = await res.json();

        let source = (lead.source || 'form').toLowerCase();
        if (source.includes('website') || source === 'webisite') source = 'form';
        if (source.includes('form')) source = 'form';

        const localUpdates = getLocalUpdates();
        const lid = id.toString();
        const normalizedLead = {
          ...lead,
          id: lid,
          source,
          status: lead.status || 'pending',
          assigned_to: lead.assigned_to ? lead.assigned_to.toString() : null,
          created_at: lead.created_at || new Date().toISOString(),
          notes: lead.notes || '',
          follow_up_date: lead.follow_up_date || null,
          follow_up_status: lead.follow_up_status || 'pending',
          follow_up_type: lead.follow_up_type || 'call'
        };

        if (localUpdates[lid]) {
          return { ...normalizedLead, ...localUpdates[lid] };
        }
        return normalizedLead;
      }
    } catch (e) {
      console.error('Direct getById failed, falling back to getAll', e);
    }

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

    // Helper to clear the local cache entry once the server confirms the save
    const clearLocalCache = () => {
      const updates = getLocalUpdates();
      delete updates[id];
      localStorage.setItem('crm_leads_local_updates', JSON.stringify(updates));
      console.log('🗑️ Cleared local cache for ID:', id, '(server confirmed save)');
    };

    // Try the direct endpoint first
    try {
      const res = await fetch(`${API_BASE}/lead/${id}?api_key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        // Server saved successfully — remove the local override so all users
        // see the same server data on next fetch (fixes cross-user sync bug).
        clearLocalCache();
        return res.json();
      }

      console.warn('⚠️ Direct update failed, trying fallback to /lead');

      // Try fallback to main endpoint (passing ID in body)
      const fallbackRes = await fetch(`${API_BASE}/lead?api_key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, id, action: 'update' }),
      });

      if (fallbackRes.ok) {
        clearLocalCache();
        return fallbackRes.json();
      }

    } catch (e) {
      console.error('❌ Network error during update:', e);
    }

    // If both fail, we still return "success" because we saved it locally.
    // The local override will be cleared automatically on the next fetch
    // once the server's updated_at timestamp catches up.
    console.log('✅ Update preserved in local cache (Backend sync pending)');
    return { success: true, local: true };
  },

  async delete(id: string) {
    const API_BASE = getApiBase();
    const API_KEY = getApiKey();

    console.log('🚀 Sending Delete Request for lead:', id);

    // Remove from local cache immediately
    const updates = getLocalUpdates();
    delete updates[id];
    localStorage.setItem('crm_leads_local_updates', JSON.stringify(updates));

    const res = await fetch(`${API_BASE}/lead/${id}?api_key=${API_KEY}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.status.toString());
      console.error('❌ API Delete Error:', res.status, errText);
      throw new Error(`Failed to delete lead: ${res.status} — ${errText}`);
    }

    console.log('✅ Lead deleted on server:', id);
    return res.json().catch(() => ({ success: true }));
  },
};
