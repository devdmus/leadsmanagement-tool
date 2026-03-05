import { useAuth } from '@/contexts/AuthContext';

const TEAM_MEMBER_ROLES = ['sales_person', 'seo_person', 'client'];

export function useDataFilter() {
  const { profile } = useAuth();

  const isTeamMember = TEAM_MEMBER_ROLES.includes(profile?.role ?? '');

  const filterByAssignment = <T extends { assigned_to?: string | null }>(items: T[]): T[] => {
    if (!isTeamMember || !profile) return items;
    return items.filter(item => item.assigned_to === profile.id);
  };

  const filterByAuthor = <T extends { author?: string | number | null }>(items: T[]): T[] => {
    if (!isTeamMember || !profile) return items;
    return items.filter(item => String(item.author) === profile.id);
  };

  return { isTeamMember, filterByAssignment, filterByAuthor };
}
