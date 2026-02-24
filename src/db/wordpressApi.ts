/**
 * WordPress API — site-aware version.
 *
 * `createWordPressApi(siteBaseUrl, authHeaderValue)` returns an api object
 * whose every call uses the given site URL and auth.
 *
 * The default export `wordpressApi` is still kept for backward compatibility
 * but new code should use `createWordPressApi` via the `useWordPressApi` hook.
 */
import { getCurrentSiteFromCache } from '@/utils/siteCache';

// Dynamic defaults (used by the legacy export) — reads from current site cache
function getDefaultWpBaseUrl(): string {
  try {
    const site = getCurrentSiteFromCache();
    if (site?.url) {
      let url = site.url.replace(/\/$/, '');
      if (!url.includes('/wp-json')) url += '/wp-json';
      return url + '/wp/v2';
    }
  } catch (_) { }
  return '';
}

function getDefaultAuthHeader(): Record<string, string> {
  try {
    const saved = localStorage.getItem('wp_credentials');
    if (saved) {
      const creds = JSON.parse(saved);
      return { Authorization: 'Basic ' + btoa(`${creds.username}:${creds.password}`) };
    }
  } catch (_) { }
  return {};
}

interface WordPressPost {
  title: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'publish' | 'private';
  featured_media?: number;
  categories?: number[];
  tags?: number[];
}

/**
 * Convert image to JPEG if it's causing issues
 */
async function convertImageToJPEG(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw white background (for transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not convert image'));
            return;
          }
          const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
          });
          resolve(newFile);
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Factory ──────────────────────────────────────────────────────────
export function createWordPressApi(wpBaseUrl: string, authHeader: Record<string, string>) {
  // Ensure the base ends with /wp/v2
  let WP_BASE_URL = wpBaseUrl.replace(/\/+$/, '');
  if (!WP_BASE_URL.endsWith('/wp/v2')) {
    if (WP_BASE_URL.endsWith('/wp-json')) {
      WP_BASE_URL += '/wp/v2';
    } else {
      WP_BASE_URL += '/wp-json/wp/v2';
    }
  }

  // Derive the site root for custom endpoints (crm/v1)
  // e.g. https://example.com/site/wp-json/wp/v2 → https://example.com/site/wp-json
  const WP_JSON_BASE = WP_BASE_URL.replace(/\/wp\/v2$/, '');

  const AUTH_HEADER = authHeader;

  return {
    // ── Posts ───────────────────────────────────────────────
    async getAllPosts() {
      // Fetch all statuses, not just published
      // brought all the data from the wordpress api
      const res = await fetch(
        `${WP_BASE_URL}/posts?_embed&per_page=100&status=publish,draft,private,pending,future&orderby=date&order=desc`,
        { headers: AUTH_HEADER }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error('WordPress API Error:', {
          status: res.status,
          statusText: res.statusText,
          url: res.url,
          response: errorText,
        });
        throw new Error(`Failed to fetch posts: ${res.status} ${res.statusText}`);
      }

      return res.json();
    },

    async getPost(id: number) {
      const res = await fetch(`${WP_BASE_URL}/posts/${id}?_embed`, {
        headers: AUTH_HEADER,
      });
      if (!res.ok) throw new Error('Failed to fetch post');
      return res.json();
    },

    async createPost(data: WordPressPost) {
      const res = await fetch(`${WP_BASE_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create post');
      }
      return res.json();
    },

    async updatePost(id: number, data: Partial<WordPressPost>) {
      const res = await fetch(`${WP_BASE_URL}/posts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update post');
      }
      return res.json();
    },

    async deletePost(id: number, force: boolean = false) {
      const res = await fetch(`${WP_BASE_URL}/posts/${id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
        headers: AUTH_HEADER,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete post');
      }
      return res.json();
    },

    // ── Media ──────────────────────────────────────────────
    async uploadMedia(file: File): Promise<{ id: number; url: string }> {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a JPEG, PNG, GIF, or WebP image');
      }

      let fileToUpload = file;

      try {
        const result = await this.doUpload(fileToUpload);
        return result;
      } catch (error: any) {
        if (
          error.message.includes('responsive image sizes') ||
          error.message.includes('image processing') ||
          error.code === 'rest_upload_image_error'
        ) {
          console.log('Converting image to JPEG and retrying...');
          try {
            fileToUpload = await convertImageToJPEG(file);
            const result = await this.doUpload(fileToUpload);
            return result;
          } catch (_conversionError: any) {
            throw new Error('Failed to upload image even after conversion. Please try a different image.');
          }
        }
        throw error;
      }
    },

    async doUpload(file: File): Promise<{ id: number; url: string }> {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      const res = await fetch(`${WP_BASE_URL}/media`, {
        method: 'POST',
        headers: { Authorization: AUTH_HEADER.Authorization },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        if (errorData?.code === 'rest_upload_image_error') {
          const err: any = new Error(errorData.message || 'Image processing failed');
          err.code = 'rest_upload_image_error';
          throw err;
        }
        if (errorData?.code === 'rest_upload_file_type_not_allowed') {
          throw new Error('This file type is not allowed. Please use JPEG, PNG, GIF, or WebP.');
        }
        if (errorData?.code === 'rest_upload_user_quota_exceeded') {
          throw new Error('Upload quota exceeded. Please contact administrator.');
        }
        throw new Error(errorData?.message || 'Failed to upload media');
      }

      const media = await res.json();
      return { id: media.id, url: media.source_url };
    },

    async deleteMedia(id: number, force: boolean = true) {
      const res = await fetch(`${WP_BASE_URL}/media/${id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
        headers: AUTH_HEADER,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete media');
      }
      return res.json();
    },

    // ── Categories ─────────────────────────────────────────
    async getCategories() {
      const res = await fetch(`${WP_BASE_URL}/categories?per_page=100`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },

    async getOrCreateCategory(name: string): Promise<number> {
      const categories = await this.getCategories();
      const existing = categories.find(
        (cat: any) => cat.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return existing.id;

      const res = await fetch(`${WP_BASE_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create category');
      }
      const newCategory = await res.json();
      return newCategory.id;
    },

    // ── Tags ───────────────────────────────────────────────
    async getTags() {
      const res = await fetch(`${WP_BASE_URL}/tags?per_page=100`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },

    async getOrCreateTag(name: string): Promise<number> {
      const tags = await this.getTags();
      const existing = tags.find(
        (tag: any) => tag.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return existing.id;

      const res = await fetch(`${WP_BASE_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create tag');
      }
      const newTag = await res.json();
      return newTag.id;
    },

    async getOrCreateTags(tagNames: string[]): Promise<number[]> {
      const tagIds = await Promise.all(tagNames.map((name) => this.getOrCreateTag(name)));
      return tagIds;
    },

    // ── Users ──────────────────────────────────────────────
    async getUsers(role?: string, customHeaders?: Record<string, string>, context: string = 'edit') {
      let url = `${WP_BASE_URL}/users?per_page=100&context=${context}`;
      if (role) url += `&roles=${role}`;

      const res = await fetch(url, { headers: customHeaders || AUTH_HEADER });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Fetch Users Error:', {
          status: res.status,
          url: res.url,
          context,
          response: text.substring(0, 500)
        });
        throw new Error(`Failed to fetch users: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },

    async createUser(data: any) {
      const res = await fetch(`${WP_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create user');
      }
      return res.json();
    },

    async updateUser(id: number, data: any) {
      const res = await fetch(`${WP_BASE_URL}/users/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update user');
      }
      return res.json();
    },

    async deleteUser(id: number, reassignId?: number) {
      let url = `${WP_BASE_URL}/users/${id}?force=true`;
      if (reassignId) url += `&reassign=${reassignId}`;

      const res = await fetch(url, { method: 'DELETE', headers: AUTH_HEADER });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      return res.json();
    },

    // ── Custom endpoints (crm/v1) ─────────────────────────
    async logActivity(action: string, details: string, customHeaders?: Record<string, string>) {
      const res = await fetch(`${WP_JSON_BASE}/crm/v1/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customHeaders || AUTH_HEADER),
        },
        body: JSON.stringify({ action, details }),
      });

      if (!res.ok) {
        console.warn('Failed to log activity:', await res.text());
      }
    },

    async getActivityLogs(page: number = 1, customHeaders?: Record<string, string>) {
      const url = `${WP_JSON_BASE}/crm/v1/logs?page=${page}`;
      const res = await fetch(url, {
        headers: customHeaders || AUTH_HEADER,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Fetch Activity Logs Error:', {
          status: res.status,
          url: res.url,
          response: text.substring(0, 500)
        });
        if (res.status === 403) throw new Error('You do not have permission to view logs');
        throw new Error(`Failed to fetch logs: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },

    // ── IP Whitelist (crm/v1) ─────────────────────────────
    async getIPWhitelist(customHeaders?: Record<string, string>) {
      const res = await fetch(`${WP_JSON_BASE}/crm/v1/ip-whitelist`, {
        headers: customHeaders || AUTH_HEADER,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`IP whitelist fetch failed (HTTP ${res.status}): ${body.slice(0, 120)}`);
      }
      return res.json() as Promise<any[]>;
    },

    async addIPWhitelist(entry: {
      id: string;
      ip: string;
      userId: string;
      username: string;
      label: string;
      addedBy: string;
      addedAt: string;
    }, customHeaders?: Record<string, string>) {
      const res = await fetch(`${WP_JSON_BASE}/crm/v1/ip-whitelist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customHeaders || AUTH_HEADER),
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Failed to add IP (HTTP ${res.status}): ${body.slice(0, 120)}`);
      }
      return res.json();
    },

    async deleteIPWhitelist(id: string, customHeaders?: Record<string, string>) {
      const res = await fetch(`${WP_JSON_BASE}/crm/v1/ip-whitelist/${id}`, {
        method: 'DELETE',
        headers: customHeaders || AUTH_HEADER,
      });
      if (!res.ok) throw new Error('Failed to remove IP from whitelist');
      return res.json();
    },

    // ── Post Types (for SEO page) ─────────────────────────
    async getPostTypes() {
      const res = await fetch(`${WP_BASE_URL}/types`);
      if (!res.ok) throw new Error('Failed to fetch post types');
      return res.json();
    },

    async getPostsByType(restBase: string) {
      const res = await fetch(`${WP_BASE_URL}/${restBase}?per_page=100`);
      if (!res.ok) throw new Error('Failed to fetch posts by type');
      return res.json();
    },

    /** Expose the base url for niche usage */
    getBaseUrl() {
      return WP_BASE_URL;
    },

    getJsonBase() {
      return WP_JSON_BASE;
    },
  };
}

// ─── Legacy default export (backward compat) ────────────────────────────
// Uses a Proxy so that each call dynamically reads the current site & credentials.
export const wordpressApi = new Proxy({} as ReturnType<typeof createWordPressApi>, {
  get(_target, prop) {
    const api = createWordPressApi(getDefaultWpBaseUrl(), getDefaultAuthHeader());
    return (api as any)[prop];
  },
});