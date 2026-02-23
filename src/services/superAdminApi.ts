const API_BASE = '/api';

export const superAdminApi = {
  // Auth
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    return res.json() as Promise<{
      token: string;
      profile: { id: number; username: string; email: string; role: 'super_admin' };
    }>;
  },

  async getMe(token: string) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Token invalid or expired');
    return res.json() as Promise<{ id: number; username: string; email: string; role: 'super_admin' }>;
  },

  // Permissions
  async getPermissions() {
    const res = await fetch(`${API_BASE}/permissions`);
    if (!res.ok) throw new Error('Failed to fetch permissions');
    return res.json() as Promise<Array<{
      id: number;
      role: string;
      feature: string;
      can_read: boolean;
      can_write: boolean;
    }>>;
  },

  async updatePermission(token: string, data: { role: string; feature: string; can_read: boolean; can_write: boolean }) {
    const res = await fetch(`${API_BASE}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update permission');
    return res.json();
  },

  async bulkUpdatePermissions(token: string, permissions: Array<{ role: string; feature: string; can_read: boolean; can_write: boolean }>) {
    const res = await fetch(`${API_BASE}/permissions/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ permissions }),
    });
    if (!res.ok) throw new Error('Failed to bulk update permissions');
    return res.json();
  },

  // Role assignments
  async getRoleAssignments(siteId?: string) {
    const url = siteId
      ? `${API_BASE}/roles/assignments?site_id=${encodeURIComponent(siteId)}`
      : `${API_BASE}/roles/assignments`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch role assignments');
    return res.json() as Promise<Array<{
      id: number;
      wp_user_id: string;
      site_id: string;
      app_role: string;
      created_at: string;
    }>>;
  },

  async assignRole(token: string, data: { wp_user_id: string; site_id: string; app_role: string }) {
    const res = await fetch(`${API_BASE}/roles/assign`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to assign role');
    return res.json();
  },

  async deleteAssignment(token: string, id: number) {
    const res = await fetch(`${API_BASE}/roles/assignments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete assignment');
    return res.json();
  },

  async getUserSites(userId: string) {
    const res = await fetch(`${API_BASE}/roles/user-sites?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('Failed to fetch user sites');
    return res.json() as Promise<Array<{
      id: number;
      wp_user_id: string;
      site_id: string;
      app_role: string;
      created_at: string;
    }>>;
  },

  async getAvailableRoles() {
    const res = await fetch(`${API_BASE}/roles`);
    if (!res.ok) throw new Error('Failed to fetch roles');
    return res.json() as Promise<string[]>;
  },
};
