import { supabase } from './supabase';

// Helper function for pagination
export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  filters?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const paginationHelper = {
  async paginate<T>(
    tableName: string,
    params: PaginationParams,
    selectQuery: string = '*',
    searchFields: string[] = []
  ): Promise<PaginatedResponse<T>> {
    const { page, pageSize, search, filters } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from(tableName).select(selectQuery, { count: 'exact' });

    // Apply search
    if (search && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => `${field}.ilike.%${search}%`).join(',');
      query = query.or(searchConditions);
    }

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    return {
      data: (data as T[]) || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },
};

// Bulk operations helper
export const bulkOperations = {
  async bulkUpdate(tableName: string, ids: string[], updates: Record<string, unknown>) {
    const { error } = await supabase
      .from(tableName)
      .update(updates)
      .in('id', ids);

    if (error) throw error;
  },

  async bulkDelete(tableName: string, ids: string[]) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .in('id', ids);

    if (error) throw error;
  },
};

// CSV Export helper
export const csvHelper = {
  exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined ? '' : String(value);
          // Escape quotes and wrap in quotes if contains comma
          return stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  },
};
