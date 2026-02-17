import { wpLeadsApi } from './wpLeadsApi';

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
            const saved = localStorage.getItem('wp_credentials');
            if (saved) {
                const creds = JSON.parse(saved);
                const auth = 'Basic ' + btoa(`${creds.username}:${creds.password}`);

                const res = await fetch('https://digitmarketus.com/Bhairavi/wp-json/wp/v2/users?context=view', {
                    headers: { 'Authorization': auth }
                });

                if (res.ok) {
                    const wpUsers = await res.json();
                    return wpUsers.map((u: any) => {
                        let role = 'client';
                        if (u.roles?.includes('administrator')) role = 'admin';
                        else if (u.roles?.includes('editor') || u.roles?.includes('seo_manager')) role = 'seo';
                        else if (u.roles?.includes('author') || u.roles?.includes('contributor')) role = 'sales';

                        return {
                            id: u.id.toString(),
                            username: u.name || u.slug,
                            email: u.email || '',
                            role: role,
                            created_at: new Date().toISOString(), // Mock, as WP doesn't expose reg date easily in simple view
                            updated_at: new Date().toISOString()
                        };
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to fetch WP users, falling back to mocks', e);
        }

        return [
            { id: '1', username: 'Admin User', email: 'admin@example.com', role: 'admin' },
            { id: '2', username: 'Sales Agent', email: 'sales@example.com', role: 'sales' },
            { id: '3', username: 'SEO Specialist', email: 'seo@example.com', role: 'seo' },
        ];
    },
    async getById(id: string) {
        const users = await this.getAll();
        return users.find((u: any) => u.id === id) || { id, username: 'User ' + id, role: 'sales' };
    }
};

// Activity Logs API
export const activityLogsApi = {
    async getAll() {
        return getLS('crm_activity_logs');
    },
    async create(data: any) {
        const logs = getLS('crm_activity_logs');
        const newLog = { id: genId(), ...data, created_at: new Date().toISOString() };
        logs.unshift(newLog);
        setLS('crm_activity_logs', logs);
        return newLog;
    }
};

// Notes API
export const notesApi = {
    async getByLeadId(leadId: string) {
        const notes = getLS('crm_notes');
        return notes.filter((n: any) => n.lead_id === leadId);
    },
    async create(data: any) {
        const notes = getLS('crm_notes');
        const newNote = { id: genId(), ...data, created_at: new Date().toISOString() };
        notes.unshift(newNote);
        setLS('crm_notes', notes);
        return newNote;
    },
    async update(id: string, data: any) {
        const notes = getLS('crm_notes');
        const idx = notes.findIndex((n: any) => n.id === id);
        if (idx > -1) {
            notes[idx] = { ...notes[idx], ...data };
            setLS('crm_notes', notes);
            return notes[idx];
        }
        return { id, ...data };
    },
    async delete(id: string) {
        let notes = getLS('crm_notes');
        notes = notes.filter((n: any) => n.id !== id);
        setLS('crm_notes', notes);
        return { success: true };
    }
};

// Follow-ups API
export const followUpsApi = {
    async getAll() {
        return getLS('crm_followups');
    },
    async getByLead(leadId: string) {
        const items = getLS('crm_followups');
        return items.filter((i: any) => i.lead_id === leadId);
    },
    async create(data: any) {
        const items = getLS('crm_followups');
        const newItem = { id: genId(), ...data, created_at: new Date().toISOString() };
        items.unshift(newItem);
        setLS('crm_followups', items);
        return newItem;
    },
    async update(id: string, data: any) {
        const items = getLS('crm_followups');
        const idx = items.findIndex((i: any) => i.id === id);
        if (idx > -1) {
            items[idx] = { ...items[idx], ...data };
            setLS('crm_followups', items);
            return items[idx];
        }
        return { id, ...data };
    },
    async delete(id: string) {
        let items = getLS('crm_followups');
        items = items.filter((i: any) => i.id !== id);
        setLS('crm_followups', items);
        return { success: true };
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

// Notifications API Mock
export const notificationsApi = {
    async getAll() {
        return getLS('crm_notifications');
    },
    async create(data: any) {
        const items = getLS('crm_notifications');
        const newItem = { id: genId(), ...data, created_at: new Date().toISOString(), is_read: false };
        items.unshift(newItem);
        setLS('crm_notifications', items);
        return newItem;
    },
    async markAsRead(id: string) {
        const items = getLS('crm_notifications');
        const idx = items.findIndex((i: any) => i.id === id);
        if (idx > -1) {
            items[idx].is_read = true;
            setLS('crm_notifications', items);
        }
        return { success: true };
    },
    async notifyAllAdmins(data: any) {
        return this.create({ ...data, role_target: 'admin' });
    }
};
