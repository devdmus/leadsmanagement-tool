import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wpLeadsApi } from '@/db/wpLeadsApi';
import { activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

/* ================= TYPES ================= */

type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo' | 'website' | 'website_contact' | string;
type LeadStatus = 'pending' | 'completed' | 'remainder';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  created_at: string;
};

type LeadWithAssignee = Lead & {
  assignee?: null;
};

/* ================= COMPONENT ================= */

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadWithAssignee[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  /* ================= LOAD DATA ================= */

  const { profile, hasPermission } = useAuth();
  const { currentSite } = useSite();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'form' as LeadSource,
    status: 'pending' as LeadStatus,
    assigned_to: 'unassigned',
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile?.id, currentSite?.id]);

  useEffect(() => {
    filterLeads();
  }, [leads, statusFilter, sourceFilter]);

  const loadData = async () => {
    try {
      const data = await wpLeadsApi.getAll();

      let mapped: LeadWithAssignee[] = data.map((l: any) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone ?? null,
        source: (l.source ?? 'website') as LeadSource,
        status: (l.status ?? 'pending') as LeadStatus,
        assigned_to: l.assigned_to ?? null,
        created_at: l.created_at,
        assignee: null,
      }));

      // Team members only see leads assigned to them
      const teamRoles = ['sales_person', 'seo_person', 'client'];
      if (profile && teamRoles.includes(profile.role)) {
        mapped = mapped.filter(l => l.assigned_to === profile.id);
      }

      setLeads(mapped);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load leads',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= FILTER ================= */

  const filterLeads = () => {
    let filtered = [...leads];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(l => (l.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(l => {
        const s = (l.source || '').toLowerCase();
        if (sourceFilter === 'form') return s.includes('form');
        return s === sourceFilter.toLowerCase();
      });
    }

    setFilteredLeads(filtered);
  };

  /* ================= CREATE LEAD ================= */

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

      // Only allow an optional leading + followed by digits only
      if (!/^\+?[0-9]+$/.test(phone)) {
        errors.phone = 'Phone number can only contain digits and an optional leading +';
        hasError = true;
      } else if ((phone.match(/\+/g) || []).length > 1) {
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
          errors.phone = 'Please enter a valid phone number';
          hasError = true;
        } else if (!phone.startsWith('+') && digits.length === 10 && !/^[6-9]/.test(digits)) {
          errors.phone = 'Invalid phone number. Indian mobile numbers must start with 6, 7, 8, or 9';
          hasError = true;
        } else if (phone.startsWith('+') && /^\+0/.test(phone)) {
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
      const created = await wpLeadsApi.create({
        ...newLead,
        phone: newLead.phone || null,
        assigned_to: null,
      });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id,
          action: 'create_lead',
          resource_type: 'lead',
          resource_id: created?.id?.toString() || 'unknown',
          details: { name: newLead.name, source: newLead.source }
        });
      }

      toast({
        title: 'Success',
        description: 'Lead created successfully',
      });

      setIsDialogOpen(false);
      setNewLead({
        name: '',
        email: '',
        phone: '',
        source: 'form',
        status: 'pending',
        assigned_to: 'unassigned',
      });

      loadData();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to create lead',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= UI HELPERS ================= */

  const getStatusBadge = (status: LeadStatus) => {
    const map = {
      pending: 'bg-warning text-white',
      completed: 'bg-success text-white',
      remainder: 'bg-info text-white',
    };
    return <Badge className={map[status]}>{status}</Badge>;
  };

  const getSourceBadge = (source: LeadSource) => (
    <Badge variant="outline">{(source as string).replace(/_/g, ' ')}</Badge>
  );

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your marketing leads
          </p>
        </div>

        {hasPermission('leads', 'write') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Lead</DialogTitle>
                <DialogDescription>Add a new lead</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newLead.name}
                    onChange={(e) => {
                      setNewLead({ ...newLead, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    className={formErrors.name ? "border-destructive" : ""}
                  />
                  {formErrors.name && <p className="text-sm text-destructive mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => {
                      setNewLead({ ...newLead, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    className={formErrors.email ? "border-destructive" : ""}
                  />
                  {formErrors.email && <p className="text-sm text-destructive mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <Label>Phone *</Label>
                  <Input
                    value={newLead.phone}
                    onChange={(e) => {
                      setNewLead({ ...newLead, phone: e.target.value });
                      if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                    }}
                    className={formErrors.phone ? "border-destructive" : ""}
                  />
                  {formErrors.phone && <p className="text-sm text-destructive mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <Label>Source</Label>
                  <Select
                    value={newLead.source}
                    onValueChange={v =>
                      setNewLead({ ...newLead, source: v as LeadSource })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="form">Form</SelectItem>
                      <SelectItem value="seo">SEO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setFormErrors({ name: '', email: '', phone: '' });
                }} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleCreateLead} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{lead.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{lead.phone ?? '-'}</TableCell>
                    <TableCell>{getSourceBadge(lead.source)}</TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                    <TableCell>
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
