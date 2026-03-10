import { wpLeadsApi } from './wpLeadsApi';
import { getCurrentSiteFromCache } from '@/utils/siteCache';

// Mock data generator for IDs
const genId = () => Math.random().toString(36).substr(2, 9);

// LocalStorage persistence for Mocks
const getLS = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLS = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

// Leads API (Pointing to wpLeadsApi)
export const leadsApi = wpLeadsApi;

// SEO Meta Tags API — uses WordPress REST API (server-side storage shared across all users)
// Falls back to localStorage if the WP endpoint is unavailable.
export const seoMetaTagsApi = {
    _getBase(): string {
        const site = getCurrentSiteFromCache();
        if (site?.url) {
            let url = site.url.replace(/\/$/, '');
            if (!url.includes('/wp-json')) url += '/wp-json';
            return url + '/crm/v1';
        }
        return '';
    },
    _getKey(): string {
        return (import.meta as any).env?.VITE_WP_API_KEY || 'SECRET123';
    },

    async getAll() {
        const base = this._getBase();
        if (base) {
            try {
                const res = await fetch(`${base}/seo-meta?api_key=${this._getKey()}&_=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    // Keep a local copy as cache for offline/fallback use
                    setLS('crm_seo_meta', data);
                    return data;
                }
            } catch (e) {
                console.warn('[seoMetaTagsApi] WP API unavailable, using localStorage fallback', e);
            }
        }
        return getLS('crm_seo_meta');
    },

    async create(data: any) {
        const base = this._getBase();
        if (base) {
            try {
                const res = await fetch(`${base}/seo-meta?api_key=${this._getKey()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) {
                    const newItem = await res.json();
                    // Sync local cache
                    const items = getLS('crm_seo_meta');
                    items.unshift(newItem);
                    setLS('crm_seo_meta', items);
                    return newItem;
                }
            } catch (e) {
                console.warn('[seoMetaTagsApi] Create via WP API failed, saving to localStorage', e);
            }
        }
        // localStorage fallback
        const items = getLS('crm_seo_meta');
        const newItem = { id: genId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        items.unshift(newItem);
        setLS('crm_seo_meta', items);
        return newItem;
    },

    async update(id: string, data: any) {
        const base = this._getBase();
        if (base) {
            try {
                const res = await fetch(`${base}/seo-meta/${id}?api_key=${this._getKey()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) {
                    // Update local cache
                    const items = getLS('crm_seo_meta');
                    const idx = items.findIndex((i: any) => String(i.id) === String(id));
                    if (idx > -1) {
                        items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
                        setLS('crm_seo_meta', items);
                    }
                    return { id, ...data };
                }
            } catch (e) {
                console.warn('[seoMetaTagsApi] Update via WP API failed, saving to localStorage', e);
            }
        }
        // localStorage fallback
        const items = getLS('crm_seo_meta');
        const idx = items.findIndex((i: any) => i.id === id);
        if (idx > -1) {
            items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
            setLS('crm_seo_meta', items);
            return items[idx];
        }
        return { id, ...data };
    },

    async delete(id: string) {
        const base = this._getBase();
        if (base) {
            try {
                const res = await fetch(`${base}/seo-meta/${id}?api_key=${this._getKey()}`, {
                    method: 'DELETE',
                });
                if (res.ok) {
                    let items = getLS('crm_seo_meta');
                    items = items.filter((i: any) => String(i.id) !== String(id));
                    setLS('crm_seo_meta', items);
                    return { success: true };
                }
            } catch (e) {
                console.warn('[seoMetaTagsApi] Delete via WP API failed, removing from localStorage', e);
            }
        }
        // localStorage fallback
        let items = getLS('crm_seo_meta');
        items = items.filter((i: any) => i.id !== id);
        setLS('crm_seo_meta', items);
        return { success: true };
    }
};

// Profiles API
export const profilesApi = {
    async getAll() {
        try {
            const site = getCurrentSiteFromCache();
            if (site?.url) {
                let url = site.url.replace(/\/$/, '');
                if (!url.includes('/wp-json')) url += '/wp-json';
                const apiBaseUrl = `${url}/crm/v1`;
                const apiKey = import.meta.env.VITE_WP_API_KEY;

                const res = await fetch(`${apiBaseUrl}/users?api_key=${apiKey}&_=${Date.now()}`);
                if (res.ok) {
                    const profiles = await res.json();

                    // Cache the successful fetch to help with fallback (e.g. if site is temporarily down)
                    sessionStorage.setItem('crm_profiles_cache', JSON.stringify(profiles));
                    return profiles;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch CRM users, falling back to cache or mocks', e);
        }

        // Try to load from session cache before falling back to mocks
        const cached = sessionStorage.getItem('crm_profiles_cache');
        if (cached) {
            return JSON.parse(cached);
        }

        return [
            { id: '1', username: 'Admin User', email: 'admin@example.com', role: 'admin' },
            { id: '2', username: 'Sales Agent', email: 'sales@example.com', role: 'sales' },
            { id: '3', username: 'SEO Specialist', email: 'seo@example.com', role: 'seo' },
        ];
    },
    async getById(id: string) {
        if (!id) return null;
        const users = await this.getAll();
        const user = users.find((u: any) => u.id === id.toString());
        if (user) return user;

        // Return a placeholder if not found so the ID is preserved in the UI
        return {
            id: id.toString(),
            username: `User ${id}`,
            role: 'unknown'
        };
    }
};

// Activity Logs API
export const activityLogsApi = {
    async getAll() {
        // Fallback to local storage for view if needed, but ActivityPage now uses wordpressApi directly
        return getLS('crm_activity_logs');
    },
    async create(data: any) {
        // Log locally first (fallback so UI never blocks)
        const logs = getLS('crm_activity_logs');
        const newLog = { id: genId(), ...data, created_at: new Date().toISOString() };
        logs.unshift(newLog);
        setLS('crm_activity_logs', logs);

        // Then attempt server-side logging via API key — works for ALL user roles,
        // not just those with wp_credentials stored in localStorage.
        try {
            const site = getCurrentSiteFromCache();
            if (site?.url) {
                const base = site.url.replace(/\/$/, '') + '/wp-json/crm/v1';
                const apiKey = (import.meta as any).env?.VITE_WP_API_KEY || 'SECRET123';

                const res = await fetch(`${base}/log?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: data.action,
                        details: JSON.stringify(data.details || {}),
                        user_id: data.user_id || '',
                        resource_type: data.resource_type || '',
                        resource_id: data.resource_id || '',
                    }),
                });

                if (!res.ok) {
                    console.warn('[activityLogsApi] Server log failed:', await res.text());
                }
            }
        } catch (e) {
            console.warn('[activityLogsApi] Failed to log activity to server:', e);
        }

        return newLog;
    }
};

// Shared helper to get the WP API base + key
function getWpBase(): { base: string; key: string } | null {
    const site = getCurrentSiteFromCache();
    if (!site?.url) return null;
    let url = site.url.replace(/\/$/, '');
    if (!url.includes('/wp-json')) url += '/wp-json';
    return { base: `${url}/crm/v1`, key: (import.meta as any).env?.VITE_WP_API_KEY || 'SECRET123' };
}

// Notes API — per-lead, multiple notes, stored in crm_lead_notes table
export const notesApi = {
    async getByLeadId(leadId: string): Promise<any[]> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/notes?api_key=${wp.key}&_=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setLS(`crm_notes_${leadId}`, data);
                    return data;
                }
            } catch (e) {
                console.warn('[notesApi] WP unavailable, using localStorage', e);
            }
        }
        return getLS(`crm_notes_${leadId}`);
    },
    async create(leadId: string, data: { content: string; note_type?: string; created_by?: string }): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/notes?api_key=${wp.key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[notesApi] create failed, using localStorage', e);
            }
        }
        // localStorage fallback
        const notes = getLS(`crm_notes_${leadId}`);
        const newNote = { id: genId(), lead_id: leadId, ...data, created_at: new Date().toISOString() };
        notes.unshift(newNote);
        setLS(`crm_notes_${leadId}`, notes);
        return newNote;
    },
    async update(leadId: string, noteId: string, data: { content?: string; note_type?: string }): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/notes/${noteId}?api_key=${wp.key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[notesApi] update failed, using localStorage', e);
            }
        }
        const notes = getLS(`crm_notes_${leadId}`);
        const idx = notes.findIndex((n: any) => String(n.id) === String(noteId));
        if (idx > -1) { notes[idx] = { ...notes[idx], ...data }; setLS(`crm_notes_${leadId}`, notes); return notes[idx]; }
        return { noteId, ...data };
    },
    async delete(leadId: string, noteId: string): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/notes/${noteId}?api_key=${wp.key}`, { method: 'DELETE' });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[notesApi] delete failed, using localStorage', e);
            }
        }
        let notes = getLS(`crm_notes_${leadId}`);
        notes = notes.filter((n: any) => String(n.id) !== String(noteId));
        setLS(`crm_notes_${leadId}`, notes);
        return { success: true };
    }
};

// Follow-ups API — per-lead, MULTIPLE follow-ups, stored in crm_lead_follow_ups table
export const followUpsApi = {
    async getByLeadId(leadId: string): Promise<any[]> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/followups?api_key=${wp.key}&_=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setLS(`crm_followups_${leadId}`, data);
                    return data;
                }
            } catch (e) {
                console.warn('[followUpsApi] WP unavailable, using localStorage', e);
            }
        }
        return getLS(`crm_followups_${leadId}`);
    },
    async create(leadId: string, data: { follow_up_date: string; type?: string; status?: string; notes?: string; created_by?: string }): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/followups?api_key=${wp.key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[followUpsApi] create failed, using localStorage', e);
            }
        }
        const followups = getLS(`crm_followups_${leadId}`);
        const item = { id: genId(), lead_id: leadId, status: 'pending', type: 'call', ...data, created_at: new Date().toISOString() };
        followups.push(item);
        setLS(`crm_followups_${leadId}`, followups);
        return item;
    },
    async update(leadId: string, followUpId: string, data: { follow_up_date?: string; type?: string; status?: string; notes?: string }): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/followups/${followUpId}?api_key=${wp.key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[followUpsApi] update failed, using localStorage', e);
            }
        }
        const followups = getLS(`crm_followups_${leadId}`);
        const idx = followups.findIndex((f: any) => String(f.id) === String(followUpId));
        if (idx > -1) { followups[idx] = { ...followups[idx], ...data }; setLS(`crm_followups_${leadId}`, followups); return followups[idx]; }
        return { followUpId, ...data };
    },
    async delete(leadId: string, followUpId: string): Promise<any> {
        const wp = getWpBase();
        if (wp) {
            try {
                const res = await fetch(`${wp.base}/leads/${leadId}/followups/${followUpId}?api_key=${wp.key}`, { method: 'DELETE' });
                if (res.ok) return res.json();
            } catch (e) {
                console.warn('[followUpsApi] delete failed, using localStorage', e);
            }
        }
        let followups = getLS(`crm_followups_${leadId}`);
        followups = followups.filter((f: any) => String(f.id) !== String(followUpId));
        setLS(`crm_followups_${leadId}`, followups);
        return { success: true };
    },
    // Legacy compat - kept so other pages don't break
    async getAll(_siteId?: string) { return []; },
    async getByLead(leadId: string) { return this.getByLeadId(leadId); },
};

// Blog Assignments API — server-side via crm/v1/blog-assignments, localStorage as fallback
export const blogAssignmentsApi = {
    _getBase(): string | null {
        try {
            const site = getCurrentSiteFromCache();
            if (site?.url) {
                let url = site.url.replace(/\/$/, '');
                if (!url.includes('/wp-json')) url += '/wp-json';
                return `${url}/crm/v1`;
            }
        } catch { }
        return null;
    },
    _getKey(): string {
        return (import.meta.env.VITE_WP_API_KEY as string) || 'SECRET123';
    },
    _getLocal(): Record<string, string | null> {
        try { return JSON.parse(localStorage.getItem('crm_blog_assignments') || '{}'); } catch { return {}; }
    },
    _setLocal(map: Record<string, string | null>) {
        localStorage.setItem('crm_blog_assignments', JSON.stringify(map));
    },
    async getAll(): Promise<Record<string, string | null>> {
        const base = this._getBase();
        if (base) {
            try {
                const res = await fetch(`${base}/blog-assignments?api_key=${this._getKey()}&_=${Date.now()}`);
                if (res.ok) {
                    const rows: Array<{ post_id: string; assigned_to: string | null }> = await res.json();
                    const map: Record<string, string | null> = {};
                    rows.forEach(r => { map[r.post_id] = r.assigned_to || null; });
                    this._setLocal(map);
                    return map;
                }
            } catch { }
        }
        return this._getLocal();
    },
    async set(postId: string, userId: string | null): Promise<void> {
        const map = this._getLocal();
        map[postId] = userId;
        this._setLocal(map);
        const base = this._getBase();
        if (base) {
            try {
                await fetch(`${base}/blog-assignments?api_key=${this._getKey()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ post_id: postId, assigned_to: userId }),
                });
            } catch { }
        }
    },
    async bulkSet(postIds: string[], userId: string | null): Promise<void> {
        const map = this._getLocal();
        postIds.forEach(id => { map[id] = userId; });
        this._setLocal(map);
        const base = this._getBase();
        if (base) {
            try {
                await fetch(`${base}/blog-assignments/bulk?api_key=${this._getKey()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ post_ids: postIds, assigned_to: userId }),
                });
            } catch { }
        }
    },
};

// Blogs API (Placeholder - will use local storage for now since crm/v1/blogs doesn't exist)
export const blogsApi = {
    async getAll() {
        return getLS('crm_blogs');
    },
    async getById(id: string) {
        const items = getLS('crm_blogs');
        return items.find((i: any) => i.id === id);
    },
    async create(data: any) {
        const items = getLS('crm_blogs');
        const newItem = {
            id: genId(),
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: data.status || 'draft'
        };
        items.unshift(newItem);
        setLS('crm_blogs', items);
        return newItem;
    },
    async update(id: string, data: any) {
        const items = getLS('crm_blogs');
        const idx = items.findIndex((i: any) => i.id === id);
        if (idx > -1) {
            items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
            setLS('crm_blogs', items);
            return items[idx];
        }
        return { id, ...data };
    },
    async delete(id: string) {
        let items = getLS('crm_blogs');
        items = items.filter((i: any) => i.id !== id);
        setLS('crm_blogs', items);
        return { success: true };
    },
    async uploadImage(file: File) {
        return URL.createObjectURL(file);
    },
    async deleteImage(_url: string) {
        return { success: true };
    }
};

// Pagination Helper Mock
export const paginationHelper = {
    async paginate(table: string, _params: any, _select: string = '*', _searchFields: string[] = []) {
        if (table === 'leads') {
            const data = await wpLeadsApi.getAll();
            return {
                data,
                total: data.length,
                page: 1,
                pageSize: data.length
            };
        }
        return { data: getLS(`crm_${table}`), total: getLS(`crm_${table}`).length, page: 1, pageSize: 20 };
    }
};

// Bulk Operations
export const bulkOperations = {
    async bulkUpdate(table: string, ids: string[], updates: any) {
        if (table === 'leads') {
            for (const id of ids) {
                await wpLeadsApi.update(id, updates);
            }
        } else {
            const dbKey = `crm_${table}`;
            const items = getLS(dbKey);
            for (const id of ids) {
                const idx = items.findIndex((i: any) => i.id === id);
                if (idx > -1) items[idx] = { ...items[idx], ...updates };
            }
            setLS(dbKey, items);
        }
        return { success: true };
    },
    async bulkDelete(table: string, ids: string[]) {
        if (table === 'leads') {
            for (const id of ids) {
                await wpLeadsApi.delete(id);
            }
        } else {
            const dbKey = `crm_${table}`;
            let items = getLS(dbKey);
            items = items.filter((i: any) => !ids.includes(i.id));
            setLS(dbKey, items);
        }
        return { success: true };
    }
};

// Chat API Mock (Using LocalStorage)
export const chatApi = {
    async getRooms() { return getLS('crm_chat_rooms'); },
    async getMessages(roomId: string) {
        const msgs = getLS('crm_chat_msgs');
        return msgs.filter((m: any) => m.roomId === roomId);
    },
    async sendMessage(roomId: string, content: string) {
        const msgs = getLS('crm_chat_msgs');
        const newMsg = { id: genId(), roomId, content, created_at: new Date().toISOString() };
        msgs.push(newMsg);
        setLS('crm_chat_msgs', msgs);
        return newMsg;
    },
    async createRoom(users: string[]) {
        const rooms = getLS('crm_chat_rooms');
        const newRoom = { id: genId(), users, created_at: new Date().toISOString() };
        rooms.push(newRoom);
        setLS('crm_chat_rooms', rooms);
        return newRoom;
    },
    subscribeToMessages(_roomId: string, _callback: () => void) {
        return { unsubscribe: () => { } };
    }
};

// Notifications API (WordPress-based)
export const notificationsApi = {
    async getAll(userId: string, siteId?: string, isSuperAdmin: boolean = false, userRole: string = '') {
        const site = getCurrentSiteFromCache();
        if (!site?.url) return [];

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications?userId=${userId}&isSuperAdmin=${isSuperAdmin}&userRole=${userRole}&api_key=${apiKey}`);
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
    },
    async create(data: any) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications?api_key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create notification');
        return res.json();
    },
    async markAsRead(id: string, userId: string) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/${id}/read?api_key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
        return res.json();
    },
    async markAllAsRead(userId: string, isSuperAdmin: boolean = false) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/read-all?api_key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, isSuperAdmin })
        });
        if (!res.ok) throw new Error('Failed to mark all notifications as read');
        return res.json();
    },
    async clearAll(userId: string, isSuperAdmin: boolean = false) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/clear?api_key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, isSuperAdmin })
        });
        if (!res.ok) throw new Error('Failed to clear notifications');
        return res.json();
    },
    async delete(id: string, userId: string) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/${id}?api_key=${apiKey}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (!res.ok) throw new Error('Failed to delete notification');
        return res.json();
    },
    async notifyAllAdmins(data: any) {
        return this.create({ ...data, role_target: 'admin' });
    }
};
