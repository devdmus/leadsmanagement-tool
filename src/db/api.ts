import { wpLeadsApi } from './wpLeadsApi';
import { getCurrentSiteFromCache } from '@/utils/siteCache';

// Mock data generator for IDs
const genId = () => Math.random().toString(36).substr(2, 9);

// LocalStorage persistence for Mocks
const getLS = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLS = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

// Leads API (Pointing to wpLeadsApi)
export const leadsApi = wpLeadsApi;

// SEO Meta Tags API Mock
export const seoMetaTagsApi = {
    async getAll() {
        return getLS('crm_seo_meta');
    },
    async create(data: any) {
        const items = getLS('crm_seo_meta');
        const newItem = { id: genId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        items.unshift(newItem);
        setLS('crm_seo_meta', items);
        return newItem;
    },
    async update(id: string, data: any) {
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
        // Log locally first (fallback)
        const logs = getLS('crm_activity_logs');
        const newLog = { id: genId(), ...data, created_at: new Date().toISOString() };
        logs.unshift(newLog);
        setLS('crm_activity_logs', logs);

        // Then attempt server-side logging
        try {
            const saved = localStorage.getItem('wp_credentials');
            if (saved) {
                const creds = JSON.parse(saved);
                const authHeader = 'Basic ' + btoa(`${creds.username}:${creds.password}`);

                const { wordpressApi } = await import('./wordpressApi');
                await wordpressApi.logActivity(data.action, JSON.stringify(data.details || {}), { Authorization: authHeader });
            }
        } catch (e) {
            console.warn('Failed to log activity to server:', e);
        }

        return newLog;
    }
};

// Notes API
export const notesApi = {
    async getByLeadId(leadId: string, _siteId?: string) {
        const lead = await leadsApi.getById(leadId);
        return lead.notes ? [{
            id: 'legacy-note',
            lead_id: leadId,
            content: lead.notes,
            created_at: lead.updated_at || lead.created_at
        }] : [];
    },
    async create(data: any) {
        return this.update(data.lead_id, data);
    },
    async update(leadId: string, data: any) {
        const lead = await leadsApi.update(leadId, { notes: data.content || data.notes });
        return {
            id: 'legacy-note',
            lead_id: leadId,
            content: lead.notes || data.content,
            created_at: new Date().toISOString()
        };
    },
    async delete(_id: string) {
        // We can't easily delete just the note via this API without knowing the lead ID
        // In the new system, deleting a note is just updating it to empty
        console.warn('Delete note called, please use update with empty content');
        return { success: true };
    }
};

// Follow-ups API
export const followUpsApi = {
    async getAll(_siteId?: string) {
        const leads = await leadsApi.getAll();
        return leads
            .filter((l: any) => l.follow_up_date)
            .map((l: any) => ({
                id: `fu-${l.id}`,
                lead_id: l.id,
                follow_up_date: l.follow_up_date,
                status: l.follow_up_status,
                type: l.follow_up_type,
                notes: l.notes
            }));
    },
    async getByLead(leadId: string, _siteId?: string) {
        const lead = await leadsApi.getById(leadId);
        if (!lead.follow_up_date) return [];
        return [{
            id: `fu-${leadId}`,
            lead_id: leadId,
            follow_up_date: lead.follow_up_date,
            status: lead.follow_up_status,
            type: lead.follow_up_type,
            notes: lead.notes
        }];
    },
    async create(data: any) {
        await leadsApi.update(data.lead_id, {
            follow_up_date: data.follow_up_date,
            follow_up_status: 'pending',
            follow_up_type: data.type || 'call'
        });
        return { id: `fu-${data.lead_id}`, ...data };
    },
    async update(id: string, data: any) {
        // ID is likely fu-{leadId}
        const leadId = id.replace('fu-', '');
        await leadsApi.update(leadId, {
            follow_up_date: data.follow_up_date,
            follow_up_status: data.status,
            follow_up_type: data.type,
            notes: data.notes
        });
        return { id, ...data };
    },
    async delete(fuId: string) {
        const leadId = fuId.replace('fu-', '');
        await leadsApi.update(leadId, {
            follow_up_date: null,
            follow_up_status: 'pending'
        });
        return { success: true };
    },
    async getDue(_siteId?: string) {
        const leads = await leadsApi.getAll();
        const now = new Date();
        return leads
            .filter((l: any) => l.follow_up_date && new Date(l.follow_up_date) <= now && l.follow_up_status === 'pending')
            .map((l: any) => ({
                id: `fu-${l.id}`,
                lead_id: l.id,
                follow_up_date: l.follow_up_date,
                status: l.follow_up_status,
                type: l.follow_up_type,
                notes: l.notes
            }));
    }
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
    async getAll(userId: string, siteId?: string, isSuperAdmin: boolean = false) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) return [];

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications?userId=${userId}&isSuperAdmin=${isSuperAdmin}&api_key=${apiKey}`);
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
    async markAsRead(id: string) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/${id}/read?api_key=${apiKey}`, {
            method: 'PATCH'
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
        return res.json();
    },
    async delete(id: string) {
        const site = getCurrentSiteFromCache();
        if (!site?.url) throw new Error('No site selected');

        let url = site.url.replace(/\/$/, '');
        if (!url.includes('/wp-json')) url += '/wp-json';
        const apiBaseUrl = `${url}/crm/v1`;
        const apiKey = import.meta.env.VITE_WP_API_KEY;

        const res = await fetch(`${apiBaseUrl}/notifications/${id}?api_key=${apiKey}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete notification');
        return res.json();
    },
    async notifyAllAdmins(data: any) {
        return this.create({ ...data, role_target: 'admin' });
    }
};
