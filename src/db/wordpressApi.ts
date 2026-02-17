const WP_BASE_URL = 'https://digitmarketus.com/Bhairavi/wp-json/wp/v2';

const AUTH_HEADER = {
  Authorization:
    'Basic ' +
    btoa('4ilwmh:syTRCaid5GHKm8xeWW1WeQ9X'),
};

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

export const wordpressApi = {
  /**
   * Fetch all posts with embedded data (including all statuses)
   */
  async getAllPosts() {
    // Fetch posts with all statuses: publish, draft, private, pending, future
    const res = await fetch(
      `${WP_BASE_URL}/posts?_embed&per_page=100&status=publish&orderby=date&order=desc`,
      {
        headers: AUTH_HEADER,
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error('WordPress API Error:', {
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        response: errorText
      });
      throw new Error(`Failed to fetch posts: ${res.status} ${res.statusText}`);
    }

    return res.json();
  },

  /**
   * Fetch a single post by ID
   */
  async getPost(id: number) {
    const res = await fetch(`${WP_BASE_URL}/posts/${id}?_embed`, {
      headers: AUTH_HEADER,
    });
    if (!res.ok) throw new Error('Failed to fetch post');
    return res.json();
  },

  /**
   * Create a new post
   */
  async createPost(data: WordPressPost) {
    const res = await fetch(`${WP_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create post');
    }
    return res.json();
  },

  /**
   * Update an existing post
   */
  async updatePost(id: number, data: Partial<WordPressPost>) {
    const res = await fetch(`${WP_BASE_URL}/posts/${id}`, {
      method: 'POST', // WordPress uses POST for updates
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update post');
    }
    return res.json();
  },

  /**
   * Delete a post (moves to trash by default)
   */
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

  /**
   * Upload media/image to WordPress with automatic JPEG conversion fallback
   */
  async uploadMedia(file: File): Promise<{ id: number; url: string }> {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload a JPEG, PNG, GIF, or WebP image');
    }

    let fileToUpload = file;

    // Try uploading the original file first
    try {
      const result = await this.doUpload(fileToUpload);
      return result;
    } catch (error: any) {
      // If image processing fails and it's not already a JPEG, try converting
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
        } catch (conversionError: any) {
          throw new Error('Failed to upload image even after conversion. Please try a different image.');
        }
      }

      throw error;
    }
  },

  /**
   * Internal method to perform the actual upload
   */
  async doUpload(file: File): Promise<{ id: number; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    const res = await fetch(`${WP_BASE_URL}/media`, {
      method: 'POST',
      headers: {
        Authorization: AUTH_HEADER.Authorization,
      },
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
    return {
      id: media.id,
      url: media.source_url,
    };
  },

  /**
   * Delete media
   */
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

  /**
   * Get all categories
   */
  async getCategories() {
    const res = await fetch(`${WP_BASE_URL}/categories?per_page=100`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  /**
   * Create or get category by name
   */
  async getOrCreateCategory(name: string): Promise<number> {
    // First, try to find existing category
    const categories = await this.getCategories();
    const existing = categories.find(
      (cat: any) => cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      return existing.id;
    }

    // Create new category
    const res = await fetch(`${WP_BASE_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create category');
    }

    const newCategory = await res.json();
    return newCategory.id;
  },

  /**
   * Get all tags
   */
  async getTags() {
    const res = await fetch(`${WP_BASE_URL}/tags?per_page=100`);
    if (!res.ok) throw new Error('Failed to fetch tags');
    return res.json();
  },

  /**
   * Create or get tag by name
   */
  async getOrCreateTag(name: string): Promise<number> {
    // First, try to find existing tag
    const tags = await this.getTags();
    const existing = tags.find(
      (tag: any) => tag.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      return existing.id;
    }

    // Create new tag
    const res = await fetch(`${WP_BASE_URL}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
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
    const tagIds = await Promise.all(
      tagNames.map(name => this.getOrCreateTag(name))
    );
    return tagIds;
  },

  /**
   * Get all users
   */
  async getUsers(role?: string) {
    let url = `${WP_BASE_URL}/users?per_page=100`;
    if (role) {
      url += `&roles=${role}`;
    }

    const res = await fetch(url, {
      headers: AUTH_HEADER,
    });

    if (!res.ok) {
      // If 401/403, might be permissions. Return empty list or throw depending on strictness.
      // For now, let's throw to be visible.
      throw new Error('Failed to fetch users');
    }
    return res.json();
  },

  /**
   * Create a new user
   */
  async createUser(data: any) {
    const res = await fetch(`${WP_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create user');
    }
    return res.json();
  },

  /**
   * Update a user
   */
  async updateUser(id: number, data: any) {
    const res = await fetch(`${WP_BASE_URL}/users/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update user');
    }
    return res.json();
  },

  /**
   * Delete a user
   */
  async deleteUser(id: number, reassignId?: number) {
    let url = `${WP_BASE_URL}/users/${id}?force=true`;
    if (reassignId) {
      url += `&reassign=${reassignId}`;
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete user');
    }
    return res.json();
  },
};