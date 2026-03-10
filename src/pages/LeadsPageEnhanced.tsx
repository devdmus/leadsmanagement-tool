import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wpLeadsApi } from '@/db/wpLeadsApi';
import { bulkOperations, csvHelper } from '@/db/helpers';
import { profilesApi, activityLogsApi } from '@/db/api';
import { socialIntegration } from '@/services/socialIntegration';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DataPagination } from '@/components/common/DataPagination';
import {
  Eye,
  Plus,
  Download,
  Upload,
  Edit,
  MoreVertical,
  Search,
  Facebook,
  Linkedin,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { UserSearchSelect } from '@/components/common/UserSearchSelect';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo' | 'website' | 'website_contact' | string;
type LeadStatus = 'pending' | 'completed' | 'remainder';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

export default function LeadsPageEnhanced() {
  const [leads, setLeads] = useState<LeadWithAssignee[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'form' as LeadSource,
    status: 'pending' as LeadStatus,
    assigned_to: 'unassigned',
  });

  const [bulkEditData, setBulkEditData] = useState({
    status: '',
    assigned_to: '',
  });


  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ total: number; success: number; failed: number; errors: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Social Integration Inputs
  const [fbConfig, setFbConfig] = useState({ pageId: '', token: '' });
  const [liConfig, setLiConfig] = useState({ accountId: '', token: '' });

  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { currentSite } = useSite();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  // Only these roles can delete leads — role list is the sole gatekeeper
  const canDeleteLead = ['super_admin', 'admin', 'seo_manager'].includes(profile?.role || '');


  // Load saved credentials from localStorage on mount
  useEffect(() => {
    const savedFb = localStorage.getItem('fb_config');
    const savedLi = localStorage.getItem('li_config');
    if (savedFb) setFbConfig(JSON.parse(savedFb));
    if (savedLi) setLiConfig(JSON.parse(savedLi));

    // Auto-Sync trigger
    const runAutoSync = async () => {
      if (savedFb) {
        const fb = JSON.parse(savedFb);
        try {
          console.log("🔄 Auto-syncing Facebook...");
          const fbLeads = await socialIntegration.fetchFacebookLeads(fb.pageId, fb.token);
          let newCount = 0;
          for (const lead of fbLeads) {
            const exists = leads.some(l => l.email === lead.email);
            if (!exists) {
              await wpLeadsApi.create({
                name: lead.name,
                email: lead.email,
                phone: lead.phone || null,
                source: 'facebook',
                status: 'pending',
                assigned_to: null,
              });
              newCount++;
            }
          }
          if (newCount > 0) {
            toast({ title: 'Auto-Sync', description: `Found ${newCount} new Facebook leads!` });
            loadLeads();
          }
        } catch (e) { console.error("Auto-sync FB failed", e); }
      }

      if (savedLi) {
        const li = JSON.parse(savedLi);
        try {
          console.log("🔄 Auto-syncing LinkedIn...");
          const liLeads = await socialIntegration.fetchLinkedInLeads(li.accountId, li.token);
          let newCount = 0;
          for (const lead of liLeads) {
            // duplicate check logic (simplified)
            const exists = leads.some(l => l.email === lead.email);
            if (!exists) {
              await wpLeadsApi.create({ ...lead, assigned_to: null });
              newCount++;
            }
          }
          if (newCount > 0) {
            toast({ title: 'Auto-Sync', description: `Found ${newCount} new LinkedIn leads!` });
            loadLeads();
          }
        } catch (e) { console.error("Auto-sync LI failed", e); }
      }
    };

    // Run auto-sync after a short delay to allow initial load
    setTimeout(runAutoSync, 2000);

  }, []); // Run once on mount

  useEffect(() => {
    loadLeads();
  }, [currentPage, pageSize, searchQuery, statusFilter, sourceFilter, dateFilter, currentSite?.id]);

  const loadLeads = async () => {
    try {
      setLoading(true);

      // Fetch data from WP REST API and Profiles
      const [data, usersData] = await Promise.all([
        wpLeadsApi.getAll(),
        profilesApi.getAll()
      ]);

      const allUsers = usersData as Profile[];
      setUsers(allUsers);

      // Map and filter data locally
      // map leads and attach assignee objects
      let filteredData: LeadWithAssignee[] = data.map((l: any) => ({
        ...l,
        assignee: allUsers.find(u => u.id === l.assigned_to) || null,
      }));

      // Team member filter: only show leads assigned to current user
      const teamRoles = ['sales_person', 'seo_person', 'client'];
      if (profile && teamRoles.includes(profile.role)) {
        filteredData = filteredData.filter(lead => lead.assigned_to === profile.id);
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(lead =>
          lead.name.toLowerCase().includes(query) ||
          lead.email.toLowerCase().includes(query) ||
          (lead.phone && lead.phone.includes(query))
        );
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter(lead => (lead.status || '').toLowerCase() === statusFilter.toLowerCase());
      }

      // Apply source filter
      if (sourceFilter !== 'all') {
        filteredData = filteredData.filter(lead => {
          const s = (lead.source || '').toLowerCase();
          if (sourceFilter === 'form') return s.includes('form');
          return s === sourceFilter.toLowerCase();
        });
      }

      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        filteredData = filteredData.filter(lead => {
          const leadDate = new Date(lead.created_at);
          switch (dateFilter) {
            case 'today':
              return leadDate.toDateString() === now.toDateString();
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return leadDate >= weekAgo;
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              return leadDate >= monthAgo;
            default:
              return true;
          }
        });
      }

      setTotalItems(filteredData.length);

      // Apply local pagination
      const start = (currentPage - 1) * pageSize;
      const paginatedData = filteredData.slice(start, start + pageSize);

      setLeads(paginatedData);
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leads from REST API',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const handleCreateLead = async () => {
    if (!hasPermission('leads', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to create leads',
        variant: 'destructive',
      });
      return;
    }

    const errors = { name: '', email: '', phone: '' };
    let hasError = false;

    if (!newLead.name.trim()) {
      errors.name = 'Name is required';
      hasError = true;
    }

    if (!newLead.email.trim()) {
      errors.email = 'Email is required';
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newLead.email)) {
        errors.email = 'Please enter a valid email address';
        hasError = true;
      }
    }

    if (!newLead.phone?.trim()) {
      errors.phone = 'Phone number is required';
      hasError = true;
    } else {
      const phone = newLead.phone.trim();

      // Only allow an optional leading + followed by digits only (no spaces, dashes, (), _, /, @, #, ! etc.)
      if (!/^\+?[0-9]+$/.test(phone)) {
        errors.phone = 'Phone number can only contain digits and an optional leading +';
        hasError = true;
      } else if ((phone.match(/\+/g) || []).length > 1) {
        // Reject multiple + signs (e.g. ++91, +1+91)
        errors.phone = 'Phone number must have at most one + symbol at the start';
        hasError = true;
      } else {
        const digits = phone.replace(/^\+/, '');

        if (digits.length < 10) {
          errors.phone = 'Phone number must be at least 10 digits';
          hasError = true;
        } else if (digits.length > 13) {
          errors.phone = 'Phone number must not exceed 13 digits';
          hasError = true;
        } else if (/^0+$/.test(digits)) {
          // Reject all-zeros
          errors.phone = 'Please enter a valid phone number';
          hasError = true;
        } else if (!phone.startsWith('+') && digits.length === 10 && !/^[6-9]/.test(digits)) {
          // For 10-digit domestic numbers, enforce Indian mobile start digit (6-9)
          errors.phone = 'Invalid phone number. Indian mobile numbers must start with 6, 7, 8, or 9';
          hasError = true;
        } else if (phone.startsWith('+') && /^\+0/.test(phone)) {
          // Country code cannot start with 0
          errors.phone = 'Country code cannot start with 0';
          hasError = true;
        }
      }
    }

    if (hasError) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({ name: '', email: '', phone: '' });

    try {
      const leadData = {
        ...newLead,
        assigned_to: newLead.assigned_to === 'unassigned' ? null : newLead.assigned_to,
        phone: newLead.phone || null,
      };

      await wpLeadsApi.create(leadData);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'create_lead',
          resource_type: 'lead',
          resource_id: null,
          details: { lead_name: newLead.name },
        });
      }

      toast({
        title: 'Success',
        description: 'Lead created successfully',
      });

      setShowCreateDialog(false);
      setNewLead({
        name: '',
        email: '',
        phone: '',
        source: 'form',
        status: 'pending',
        assigned_to: 'unassigned',
      });
      loadLeads();
    } catch (error) {
      console.error('Failed to create lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to create lead',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedLeads.length === 0) return;

    setIsBulkEditing(true);
    try {
      const updates: Record<string, unknown> = {};
      if (bulkEditData.status) updates.status = bulkEditData.status;
      if (bulkEditData.assigned_to) {
        updates.assigned_to = bulkEditData.assigned_to === 'unassigned' ? null : bulkEditData.assigned_to;
      }

      await bulkOperations.bulkUpdate('leads', selectedLeads, updates);

      toast({
        title: 'Success',
        description: `Updated ${selectedLeads.length} leads`,
      });

      setShowBulkEditDialog(false);
      setSelectedLeads([]);
      setBulkEditData({ status: '', assigned_to: '' });
      loadLeads();
    } catch (error) {
      console.error('Failed to bulk edit:', error);
      toast({
        title: 'Error',
        description: 'Failed to update leads',
        variant: 'destructive',
      });
    } finally {
      setIsBulkEditing(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!hasPermission('leads', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to delete leads',
        variant: 'destructive',
      });
      return;
    }

    // Optimistically remove from UI immediately
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setSelectedLeads(prev => prev.filter(id => id !== leadId));

    try {
      await wpLeadsApi.delete(leadId);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_lead',
          resource_type: 'lead',
          resource_id: leadId,
          details: { lead_id: leadId },
        });
      }

      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      });

      loadLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      });
      // Reload to restore the lead if deletion failed
      loadLeads();
    }
  };

  const handleExport = () => {
    const exportData = leads.map(lead => ({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      source: lead.source,
      status: lead.status,
      assigned_to: lead.assignee?.username || '',
      created_at: new Date(lead.created_at).toLocaleDateString(),
    }));

    csvHelper.exportToCSV(exportData, `leads_export_${new Date().toISOString().split('T')[0]}.csv`);

    toast({
      title: 'Success',
      description: 'Leads exported successfully',
    });
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportSummary(null);

    try {
      const text = await importFile.text();
      const data = csvHelper.parseCSV(text);

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Validation similar to handleCreateLead
          if (!row.name || !row.name.trim()) {
            throw new Error('Name is required');
          }
          if (!row.email || !row.email.trim()) {
            throw new Error('Email is required');
          } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email)) {
              throw new Error(`Invalid email format`);
            }
          }
          if (row.phone && row.phone.trim()) {
            const phone = row.phone.trim();
            if (!/^\+?[0-9]+$/.test(phone)) throw new Error('Phone can only contain digits and an optional leading +');
            if ((phone.match(/\+/g) || []).length > 1) throw new Error('Phone has multiple + symbols');

            const digits = phone.replace(/^\+/, '');
            if (digits.length < 10) throw new Error('Phone is too short (min 10 digits)');
            if (digits.length > 13) throw new Error('Phone is too long (max 13 digits)');
            if (/^0+$/.test(digits)) throw new Error('Phone number is invalid (all zeros)');
          }

          const leadData = {
            name: row.name.trim(),
            email: row.email.trim(),
            phone: row.phone ? row.phone.trim() : null,
            source: (row.source as LeadSource) || 'form',
            status: (row.status as LeadStatus) || 'pending',
            assigned_to: null,
          };

          await wpLeadsApi.create(leadData);
          successCount++;
        } catch (err: any) {
          failedCount++;
          const reason = err.message || 'Unknown error';
          errors.push(`Row ${i + 1} (${row.email || 'No Email'}): ${reason}`);
        }
      }

      setImportSummary({
        total: data.length,
        success: successCount,
        failed: failedCount,
        errors
      });

      if (failedCount === 0) {
        toast({
          title: 'Success',
          description: `Imported ${successCount} leads successfully`,
        });
        // Auto-close on perfect success
        setTimeout(() => {
          setShowImportDialog(false);
          setImportFile(null);
          setImportSummary(null);
        }, 2000);
      } else if (successCount > 0) {
        toast({
          title: 'Partial Success',
          description: `Imported ${successCount} leads, but ${failedCount} failed`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: `All ${failedCount} rows failed to import`,
          variant: 'destructive'
        });
      }

      loadLeads();
    } catch (error) {
      console.error('Failed to parse import:', error);
      toast({
        title: 'Error',
        description: 'Failed to read or parse the CSV file',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSocialSync = async (source: 'facebook' | 'linkedin') => {
    setSyncing(true);
    try {
      let importedCount = 0;

      if (source === 'facebook') {
        // MOCK MODE: If token is 'test', generate dummy data
        if (fbConfig.token === 'test' || fbConfig.token === 'mock') {
          const mockLeads = [
            { name: 'Sarah Connor', email: 'sarah.c@example.com', source: 'facebook', status: 'pending', phone: '+1-555-0199' },
            { name: 'Kyle Reese', email: 'kyle.r@example.com', source: 'facebook', status: 'pending', phone: '+1-555-0198' },
            { name: 'John Connor', email: 'john.c@example.com', source: 'facebook', status: 'pending', phone: '+1-555-0197' }
          ];

          for (const lead of mockLeads) {
            await wpLeadsApi.create({ ...lead, assigned_to: null });
            importedCount++;
          }

          await new Promise(r => setTimeout(r, 1000)); // fake delay
        } else {
          // Real Logic
          if (!fbConfig.pageId || !fbConfig.token) {
            throw new Error('Please enter both Page ID and Access Token');
          }

          const fbLeads = await socialIntegration.fetchFacebookLeads(fbConfig.pageId, fbConfig.token);

          if (fbLeads.length === 0) {
            // FALLBACK FOR DEMO: If connected but no leads, generate dummy "Techconnective" leads
            const demoLeads = [
              { name: 'Tech Lead 1', email: 'tech1@techconnective.com', source: 'facebook', status: 'pending', phone: '+91-9876543210' },
              { name: 'Tech Lead 2', email: 'tech2@techconnective.com', source: 'facebook', status: 'pending', phone: '+91-9876543211' }
            ];

            toast({ title: 'Connected!', description: 'No real leads found, generating DEMO leads for you.' });

            for (const lead of demoLeads) {
              await wpLeadsApi.create({ ...lead, assigned_to: null });
              importedCount++;
            }
          } else {

            for (const lead of fbLeads) {
              const exists = leads.some(l => l.email === lead.email);
              if (!exists) {
                await wpLeadsApi.create({
                  name: lead.name,
                  email: lead.email,
                  phone: lead.phone || null,
                  source: 'facebook',
                  status: 'pending',
                  assigned_to: null,
                });
                importedCount++;
              }
            }
          }

          // Save valid config for Auto-Sync
          localStorage.setItem('fb_config', JSON.stringify(fbConfig));
        }
      } else {
        // LinkedIn Logic
        if (!liConfig.accountId || !liConfig.token) {
          throw new Error("Please enter both Ad Account ID and Access Token");
        }

        const liLeads = await socialIntegration.fetchLinkedInLeads(liConfig.accountId, liConfig.token);

        if (liLeads.length === 0) {
          toast({ title: 'No new leads found', description: 'Check your time range or permissions.' });
          setSyncing(false);
          return;
        }

        for (const lead of liLeads) {
          // Check if exists
          const exists = leads.some(l => l.email === lead.email);
          if (!exists) {
            await wpLeadsApi.create({
              name: lead.name,
              email: lead.email,
              phone: lead.phone || null,
              source: 'linkedin',
              status: 'pending',
              assigned_to: null,
            });
            importedCount++;
          }
        }
      }

      toast({
        title: 'Sync Complete',
        description: `Successfully imported ${importedCount} new leads from ${source}.`,
      });

      setShowImportDialog(false);
      loadLeads();
    } catch (error: any) {
      console.error('Sync failed', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Could not connect to external service.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };


  const getStatusBadge = (status: LeadStatus) => {
    const variants = {
      pending: 'bg-warning text-warning-foreground',
      completed: 'bg-success text-success-foreground',
      remainder: 'bg-info text-info-foreground',
    };
    const className = variants[status] || 'bg-muted text-muted-foreground';
    return <Badge className={className}>{status}</Badge>;
  };

  const getSourceBadge = (source: LeadSource) => {
    const config: Record<string, { icon: any, color: string }> = {
      facebook: { icon: Facebook, color: 'bg-blue-500' },
      linkedin: { icon: Linkedin, color: 'bg-blue-700' },
      form: { icon: null, color: 'bg-green-500' },
      seo: { icon: null, color: 'bg-purple-500' },
      website: { icon: null, color: 'bg-slate-500' },
      website_contact: { icon: null, color: 'bg-slate-600' },
    };
    const key = (source as string).toLowerCase();
    const item = config[key] || { icon: null, color: 'bg-slate-500' };
    const { icon: Icon, color } = item;
    return (
      <Badge className={cn(color, 'text-white')}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {(source as string).replace(/_/g, ' ')}
      </Badge>
    );
  };

  // Mask email: show first 3 chars + XXXXXXX (cap at 10 total) + ...
  const maskEmail = (email: string) => {
    if (!email) return 'XXX...';
    const visible = email.slice(0, 3);
    return `${visible}XXXXXXX...`;
  };

  // Mask phone: show first 3 chars + X for each remaining digit
  const maskPhone = (phone: string | null) => {
    if (!phone) return '-';
    const visible = phone.slice(0, 3);
    const masked = 'X'.repeat(Math.max(4, phone.length - 3));
    return `${visible}${masked}`;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(leads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId]);
    } else {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-end md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads Management</h1>
          <p className="text-muted-foreground">Manage and track your marketing leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Add Lead, Import, Export — super_admin and admin only */}
          {isAdmin && (
            <>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </>
          )}
          {/* Bulk Edit — any user with leads write permission */}
          {hasPermission('leads', 'write') && selectedLeads.length > 0 && (
            <Button variant="outline" onClick={() => setShowBulkEditDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Bulk Edit ({selectedLeads.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="remainder">Remainder</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="form">Form</SelectItem>
                <SelectItem value="seo">SEO</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button className='self-end'
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSourceFilter('all');
                setDateFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {hasPermission('leads', 'write') && (
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedLeads.length === leads.length && leads.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                      <TableHead className="hidden xl:table-cell">Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No leads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((lead) => (
                        <TableRow key={lead.id} className="hover:bg-muted/50 transition-colors">
                          {hasPermission('leads', 'write') && (
                            <TableCell>
                              <Checkbox
                                checked={selectedLeads.includes(lead.id)}
                                onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground font-mono text-sm">{maskEmail(lead.email)}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-sm">{maskPhone(lead.phone)}</TableCell>
                          <TableCell>{getSourceBadge(lead.source)}</TableCell>
                          <TableCell>{getStatusBadge(lead.status)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {lead.assignee ? lead.assignee.username : 'Unassigned'}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {canDeleteLead && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setLeadToDelete(lead.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Lead
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalItems / pageSize)}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>Add a new lead to your pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newLead.name}
                onChange={(e) => {
                  setNewLead({ ...newLead, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                }}
                placeholder="John Doe"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-sm text-destructive mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newLead.email}
                onChange={(e) => {
                  setNewLead({ ...newLead, email: e.target.value });
                  if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                }}
                placeholder="john@example.com"
                className={formErrors.email ? "border-destructive" : ""}
              />
              {formErrors.email && <p className="text-sm text-destructive mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={newLead.phone}
                onChange={(e) => {
                  setNewLead({ ...newLead, phone: e.target.value });
                  if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                }}
                placeholder="+1-555-0123"
                className={formErrors.phone ? "border-destructive" : ""}
              />
              {formErrors.phone && <p className="text-sm text-destructive mt-1">{formErrors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                value={newLead.source}
                onValueChange={(value) => setNewLead({ ...newLead, source: value as LeadSource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="seo">SEO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={newLead.status}
                onValueChange={(value) => setNewLead({ ...newLead, status: value as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="remainder">Remainder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor="assigned_to">Assign To</Label>
              <UserSearchSelect
                users={users}
                value={newLead.assigned_to}
                onValueChange={(value) => setNewLead({ ...newLead, assigned_to: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setFormErrors({ name: '', email: '', phone: '' });
            }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateLead} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Leads</DialogTitle>
            <DialogDescription>
              Update {selectedLeads.length} selected leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk_status">Status</Label>
              <Select
                value={bulkEditData.status}
                onValueChange={(value) => setBulkEditData({ ...bulkEditData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="remainder">Remainder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bulk_assigned_to">Assign To</Label>
              <UserSearchSelect
                users={users}
                value={bulkEditData.assigned_to}
                onValueChange={(value) => setBulkEditData({ ...bulkEditData, assigned_to: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditDialog(false)} disabled={isBulkEditing}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={isBulkEditing}>
              {isBulkEditing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Leads'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Leads</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: name, email, phone, source, status
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="hidden">
            {/* Footer handled inside TabsContent */}
          </DialogFooter>
          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="csv">CSV File</TabsTrigger>
              <TabsTrigger value="facebook">Facebook</TabsTrigger>
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <Label htmlFor="import_file" className="cursor-pointer">
                    Click to browse CSV file
                  </Label>
                  <Input
                    id="import_file"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportSummary(null); // Reset summary on new file
                    }}
                  />
                  {importFile && (
                    <p className="text-sm text-primary font-medium mt-2">
                      {importFile.name}
                    </p>
                  )}
                </div>
                {!importSummary && (
                  <p className="text-xs text-muted-foreground text-center">
                    Required columns: name, email, phone, source, status
                  </p>
                )}

                {importSummary && (
                  <div className="rounded-md bg-muted p-4 mt-4 space-y-2 text-sm">
                    <p className="font-semibold text-foreground">Import Summary</p>
                    <p>Total Processed: {importSummary.total}</p>
                    <p className="text-green-600">Successfully Imported: {importSummary.success}</p>
                    <p className="text-red-500">Failed: {importSummary.failed}</p>

                    {importSummary.errors.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="font-semibold text-red-500 mb-1">Errors:</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto custom-scrollbar">
                          {importSummary.errors.map((err, i) => (
                            <li key={i} className="text-red-500/90">{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setShowImportDialog(false);
                  setImportSummary(null);
                  setImportFile(null);
                }} disabled={isImporting}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importFile || isImporting}>
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isImporting ? 'Importing...' : 'Import File'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="facebook" className="space-y-4 py-4">
              <Accordion type="single" collapsible className="w-full mb-4">
                <AccordionItem value="instructions">
                  <AccordionTrigger>How to connect Facebook Lead Ads?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>1. Go to <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-primary underline">Facebook for Developers</a> and create an App.</p>
                    <p>2. Add the <strong>Marketing API</strong> product to your app.</p>
                    <p>3. Generate a <strong>Page Access Token</strong> with <code>ads_management</code> and <code>leads_retrieval</code> permissions.</p>
                    <p>4. Copy your <strong>Page ID</strong> and the <strong>Access Token</strong> below.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="fb_page_id">Page ID</Label>
                  <Input
                    id="fb_page_id"
                    placeholder="123456789"
                    value={fbConfig.pageId}
                    onChange={(e) => setFbConfig({ ...fbConfig, pageId: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fb_token">Access Token</Label>
                  <Input
                    id="fb_token"
                    type="password"
                    placeholder="EAA..."
                    value={fbConfig.token}
                    onChange={(e) => setFbConfig({ ...fbConfig, token: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Facebook className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Facebook Lead Ads</h4>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Sync leads directly from your connected Facebook Page.
                  </p>
                </div>
                {syncing ? (
                  <Button disabled className="w-full">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Syncing Leads...
                  </Button>
                ) : (
                  <Button onClick={() => handleSocialSync('facebook')} className="w-full">
                    Connect & Sync
                  </Button>
                )}
              </div>
            </TabsContent>
            <TabsContent value="linkedin" className="space-y-4 py-4">
              <Accordion type="single" collapsible className="w-full mb-4">
                <AccordionItem value="instructions">
                  <AccordionTrigger>How to connect LinkedIn Gen Forms?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>1. Go to <a href="https://www.linkedin.com/developers/" target="_blank" rel="noreferrer" className="text-primary underline">LinkedIn Developers</a> and create an App.</p>
                    <p>2. Verify your business and request access to the <strong>Marketing Developer Platform</strong>.</p>
                    <p>3. In the <strong>Auth</strong> tab, find your <strong>Client ID</strong> and <strong>Client Secret</strong>.</p>
                    <p>4. Enter them below to authorize the connection.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="li_account_id">Ad Account ID</Label>
                  <Input
                    id="li_account_id"
                    placeholder="507..."
                    value={liConfig.accountId}
                    onChange={(e) => setLiConfig({ ...liConfig, accountId: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="li_token">Access Token</Label>
                  <Input
                    id="li_token"
                    type="password"
                    placeholder="AQ..."
                    value={liConfig.token}
                    onChange={(e) => setLiConfig({ ...liConfig, token: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Linkedin className="h-6 w-6 text-blue-700 dark:text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">LinkedIn Gen Forms</h4>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Import leads directly from your LinkedIn Lead Gen Forms.
                  </p>
                </div>
                {syncing ? (
                  <Button disabled className="w-full">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Syncing Leads...
                  </Button>
                ) : (
                  <Button onClick={() => handleSocialSync('linkedin')} className="w-full">
                    Connect & Sync
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Lead Confirmation */}
      <AlertDialog open={leadToDelete !== null} onOpenChange={(open) => { if (!open) setLeadToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>"{leads.find(l => l.id === leadToDelete)?.name ?? 'this lead'}"</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeadToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (leadToDelete) {
                  handleDeleteLead(leadToDelete);
                  setLeadToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
