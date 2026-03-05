import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  lead_manager: 'Sales Manager',
  sales_manager: 'Sales Manager',
  seo_manager: 'SEO Manager',
  sales_person: 'Sales Person',
  seo_person: 'SEO Person',
  client: 'Client',
  // WP custom role slug aliases
  sales: 'Sales Person',
  seo: 'SEO Manager',
  manager: 'Sales Manager',
  subscriber: 'Client',
  contributor: 'Sales Person',
  author: 'SEO Person',
  editor: 'SEO Manager',
  administrator: 'Admin',
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export type Params = Partial<
  Record<keyof URLSearchParams, string | number | null | undefined>
>;

export function createQueryString(
  params: Params,
  searchParams: URLSearchParams
) {
  const newSearchParams = new URLSearchParams(searchParams?.toString());

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      newSearchParams.delete(key);
    } else {
      newSearchParams.set(key, String(value));
    }
  }

  return newSearchParams.toString();
}

export function formatDate(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = {}
) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: opts.month ?? "long",
    day: opts.day ?? "numeric",
    year: opts.year ?? "numeric",
    ...opts,
  }).format(new Date(date));
}
