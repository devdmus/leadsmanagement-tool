// Pagination Params Type
export interface PaginationParams {
    page: number;
    pageSize: number;
    search?: string;
    filters?: Record<string, any>;
    orderBy?: string;
    order?: 'asc' | 'desc';
}

// CSV Helper
export const csvHelper = {
    exportToCSV(data: any[], filename: string) {
        if (data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header] ?? '';
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                }).join(',')
            )
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

    parseCSV(text: string) {
        const lines = text.split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj: any = {};
            headers.forEach((header, i) => {
                obj[header] = values[i];
            });
            return obj;
        });
    }
};

// Re-exporting from api.ts if needed, but for now keeping them separate as expected by imports
import { bulkOperations as bo, paginationHelper as ph } from './api';
export const bulkOperations = bo;
export const paginationHelper = ph;
