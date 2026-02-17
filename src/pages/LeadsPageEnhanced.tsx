import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wpLeadsApi } from '@/db/wpLeadsApi';
import { bulkOperations, csvHelper } from '@/db/helpers';
import { profilesApi, activityLogsApi, followUpsApi } from '@/db/api';
import { socialIntegration } from '@/services/socialIntegration';
import { useAuth } from '@/contexts/AuthContext';
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
  Calendar,
  Facebook,
  Linkedin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo' | 'website';
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedLeadForFollowUp, setSelectedLeadForFollowUp] = useState<string | null>(null);

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

  const [followUpData, setFollowUpData] = useState({
    follow_up_date: '',
    notes: '',
    type: 'call',
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Social Integration Inputs
  const [fbConfig, setFbConfig] = useState({ pageId: '', token: '' });
  const [liConfig, setLiConfig] = useState({ accountId: '', token: '' });

  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();


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
  }, [currentPage, pageSize, searchQuery, statusFilter, sourceFilter, dateFilter]);

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
        filteredData = filteredData.filter(lead => lead.status === statusFilter);
      }

      // Apply source filter
      if (sourceFilter !== 'all') {
        filteredData = filteredData.filter(lead => lead.source === sourceFilter);
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
    }
  };

  const handleBulkEdit = async () => {
    if (selectedLeads.length === 0) return;

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

    try {
      const text = await importFile.text();
      const data = csvHelper.parseCSV(text);

      for (const row of data) {
        const leadData = {
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || null,
          source: (row.source as LeadSource) || 'form',
          status: (row.status as LeadStatus) || 'pending',
          assigned_to: null,
        };

        await wpLeadsApi.create(leadData);
      }

      toast({
        title: 'Success',
        description: `Imported ${data.length} leads`,
      });

      setShowImportDialog(false);
      setImportFile(null);
      loadLeads();
    } catch (error) {
      console.error('Failed to import:', error);
      toast({
        title: 'Error',
        description: 'Failed to import leads',
        variant: 'destructive',
      });
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

  const handleCreateFollowUp = async () => {
    if (!selectedLeadForFollowUp || !profile) return;

    if (!followUpData.follow_up_date) {
      toast({
        title: 'Valid Date Required',
        description: 'Please select a date and time for the follow-up.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await followUpsApi.create({
        lead_id: selectedLeadForFollowUp,
        user_id: profile.id as string,
        follow_up_date: followUpData.follow_up_date,
        notes: followUpData.notes,
        type: followUpData.type,
      });

      // Update lead status to 'remainder' (Reminder)
      await wpLeadsApi.update(selectedLeadForFollowUp, { status: 'remainder' });

      toast({
        title: 'Success',
        description: 'Follow-up scheduled & Lead status updated to Remainder',
      });

      setShowFollowUpDialog(false);
      setSelectedLeadForFollowUp(null);
      setFollowUpData({ follow_up_date: '', notes: '', type: 'call' });
      loadLeads();
    } catch (error) {
      console.error('Failed to create follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule follow-up',
        variant: 'destructive',
      });
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
    };
    const item = config[source] || { icon: null, color: 'bg-muted' };
    const { icon: Icon, color } = item;
    return (
      <Badge className={cn(color, 'text-white')}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {source}
      </Badge>
    );
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads Management</h1>
          <p className="text-muted-foreground">Manage and track your marketing leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('leads', 'write') && (
            <>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              {selectedLeads.length > 0 && (
                <Button variant="outline" onClick={() => setShowBulkEditDialog(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Bulk Edit ({selectedLeads.length})
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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

            <Button
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
                          <TableCell className="max-w-[200px] truncate">{lead.email}</TableCell>
                          <TableCell className="hidden md:table-cell">{lead.phone || '-'}</TableCell>
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
                                {hasPermission('leads', 'write') && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedLeadForFollowUp(lead.id);
                                      setShowFollowUpDialog(true);
                                    }}
                                  >
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Schedule Follow-up
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
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                placeholder="+1-555-0123"
              />
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
            <div>
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={newLead.assigned_to}
                onValueChange={(value) => setNewLead({ ...newLead, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLead}>Create Lead</Button>
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
              <Select
                value={bulkEditData.assigned_to}
                onValueChange={(value) => setBulkEditData({ ...bulkEditData, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit}>Update Leads</Button>
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
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <p className="text-sm text-primary font-medium mt-2">
                      {importFile.name}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Required columns: name, email, phone, source, status
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importFile}>
                  Import File
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

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription>
              Set a reminder to follow up with this lead
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="follow_up_date">Follow-up Date & Time</Label>
              <Input
                id="follow_up_date"
                type="datetime-local"
                value={followUpData.follow_up_date}
                onChange={(e) => setFollowUpData({ ...followUpData, follow_up_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="follow_up_type">Interaction Type</Label>
              <Select
                value={followUpData.type}
                onValueChange={(value) => setFollowUpData({ ...followUpData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn Message</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="follow_up_notes">Notes</Label>
              <Input
                id="follow_up_notes"
                value={followUpData.notes}
                onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                placeholder="Add notes for this follow-up"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFollowUp}>Schedule Reminder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
