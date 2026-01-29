import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi, profilesApi, activityLogsApi, followUpsApi } from '@/db/api';
import { bulkOperations, csvHelper, paginationHelper, type PaginationParams } from '@/db/helpers';
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
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo';
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
  });

  const [importFile, setImportFile] = useState<File | null>(null);

  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadLeads();
    loadUsers();
  }, [currentPage, pageSize, searchQuery, statusFilter, sourceFilter, dateFilter]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      
      const filters: Record<string, unknown> = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (sourceFilter !== 'all') filters.source = sourceFilter;

      const params: PaginationParams = {
        page: currentPage,
        pageSize,
        search: searchQuery,
        filters,
      };

      const result = await paginationHelper.paginate<LeadWithAssignee>(
        'leads',
        params,
        '*, assignee:profiles!assigned_to(*)',
        ['name', 'email', 'phone']
      );

      let filteredData = result.data;

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

      setLeads(filteredData);
      setTotalItems(result.total);
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leads',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await profilesApi.getAll();
      setUsers(data as Profile[]);
    } catch (error) {
      console.error('Failed to load users:', error);
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

      await leadsApi.create(leadData);

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

        await leadsApi.create(leadData);
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

  const handleCreateFollowUp = async () => {
    if (!selectedLeadForFollowUp || !profile) return;

    try {
      await followUpsApi.create({
        lead_id: selectedLeadForFollowUp,
        user_id: profile.id as string,
        follow_up_date: followUpData.follow_up_date,
        notes: followUpData.notes,
      });

      toast({
        title: 'Success',
        description: 'Follow-up scheduled successfully',
      });

      setShowFollowUpDialog(false);
      setSelectedLeadForFollowUp(null);
      setFollowUpData({ follow_up_date: '', notes: '' });
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
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  const getSourceBadge = (source: LeadSource) => {
    const config = {
      facebook: { icon: Facebook, color: 'bg-blue-500' },
      linkedin: { icon: Linkedin, color: 'bg-blue-700' },
      form: { icon: null, color: 'bg-green-500' },
      seo: { icon: null, color: 'bg-purple-500' },
    };
    const { icon: Icon, color } = config[source];
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="import_file">CSV File</Label>
              <Input
                id="import_file"
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
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
              <Label htmlFor="follow_up_date">Follow-up Date</Label>
              <Input
                id="follow_up_date"
                type="datetime-local"
                value={followUpData.follow_up_date}
                onChange={(e) => setFollowUpData({ ...followUpData, follow_up_date: e.target.value })}
              />
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
            <Button onClick={handleCreateFollowUp}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
