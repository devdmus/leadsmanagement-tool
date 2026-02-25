import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { wpLeadsApi as leadsApi } from '@/db/wpLeadsApi';
// @ts-ignore
import { profilesApi, notesApi, activityLogsApi, followUpsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { notificationHelper } from '@/lib/notificationHelper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ArrowLeft, Mail, Phone, Calendar, Trash2, Edit, Plus, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type UserRole = 'admin' | 'sales' | 'seo' | 'client';
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo' | 'website' | 'website_contact' | string;
type LeadStatus = 'pending' | 'completed' | 'remainder';

type Profile = {
  id: string;
  username: string;
  role: UserRole;
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  follow_up_date?: string | null;
  follow_up_status?: string | null;
  follow_up_type?: string | null;
};

// Simplified types for single-field model
type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState<LeadWithAssignee | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNote, setNewNote] = useState('');
  const [noteReason, setNoteReason] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('pending');
  const [followUpType, setFollowUpType] = useState('call');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [leadData, usersData] = await Promise.all([
        leadsApi.getById(id),
        profilesApi.getAll(),
      ]);

      if (!leadData) {
        throw new Error('Lead not found');
      }

      const allUsers = usersData as Profile[];
      const assignedToId = leadData.assigned_to?.toString();

      setLead({
        ...leadData,
        assignee: allUsers.find(u => u.id === assignedToId) || (assignedToId ? { id: assignedToId, username: `User ${assignedToId}`, role: 'unknown' } : null)
      } as LeadWithAssignee);
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load lead details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lead details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLead = async (field: string, value: string) => {
    if (!id || !hasPermission('leads', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to update leads',
        variant: 'destructive',
      });
      return;
    }

    const updateValue = value === 'unassigned' ? null : (value || null);

    // 1. Optimistic update and instant feedback prevents the user from feeling stuck
    setLead((prev: any) => prev ? { ...prev, [field]: updateValue } : prev);

    toast({
      title: 'Success',
      description: `Lead ${field} updated successfully`,
    });

    // 2. Perform the slow network requests in the background so the Select dropdown can close immediately
    setTimeout(async () => {
      try {
        await leadsApi.update(id, { [field]: updateValue });

        if (profile) {
          try {
            await activityLogsApi.create({
              user_id: profile.id as string,
              action: 'update_lead',
              resource_type: 'lead',
              resource_id: id,
              details: { field, value },
            });

            await notificationHelper.notifyUserAndAdmins(
              profile.id as string,
              'Lead Updated',
              `Lead "${lead?.name}" ${field} has been updated.`,
              'success',
              'lead_updated',
              'lead',
              id
            );

            if (field === 'assigned_to' && updateValue) {
              await notificationHelper.notifyUser(
                updateValue,
                'New Lead Assigned',
                `You have been assigned to lead "${lead?.name}".`,
                'info',
                'lead_assigned',
                'lead',
                id
              );
            }
          } catch (logErr) {
            console.warn('Logging side effects failed, but lead was updated', logErr);
          }
        }

        // Silently reload data to ensure sync with backend
        loadData();
      } catch (error) {
        console.error('Failed to update lead on the backend:', error);
        toast({
          title: 'Warning',
          description: 'Failed to sync update with the server. Data might revert.',
          variant: 'destructive',
        });
      }
    }, 0);
  };

  const handleSaveNote = async () => {
    if (!id || !profile || !newNote.trim()) return;

    try {
      // In the new system, we just update the lead's notes column
      await notesApi.update(id, {
        content: newNote,
        reason: noteReason || null,
        note_type: noteType,
      });

      await notificationHelper.notifyUserAndAdmins(
        profile.id as string,
        'Lead Note Updated',
        `Note on lead "${lead?.name}" has been updated.`,
        'success',
        'note_updated',
        'lead',
        id
      );

      toast({
        title: 'Success',
        description: 'Note updated successfully',
      });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'update_note',
          resource_type: 'note',
          resource_id: id,
          details: { content: newNote },
        });
      }

      setNoteReason('');
      setNoteType('general');
      setEditingNote(null);
      setShowNoteDialog(false);
      loadData();
    } catch (error) {
      console.error('Failed to save note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async () => {
    if (!id) return;
    try {
      // Deleting a note in single-field system means clearing it
      await notesApi.update(id, { content: '' });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_note',
          resource_type: 'note',
          resource_id: id,
          details: { action: 'cleared' },
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Note Removed',
          `Note on lead "${lead?.name}" has been removed.`,
          'warning',
          'note_deleted',
          'lead',
          id
        );
      }

      toast({
        title: 'Success',
        description: 'Note removed successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to remove note:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove note',
        variant: 'destructive',
      });
    }
  };

  const handleSaveFollowUp = async () => {
    if (!id || !profile || !followUpDate) return;

    try {
      // Simplified to always update the single lead object
      await followUpsApi.update(`fu-${id}`, {
        follow_up_date: followUpDate,
        notes: followUpNotes || undefined,
        status: followUpStatus,
        type: followUpType,
      });

      // Auto-update lead status to remainder if scheduling for the first time
      if (!lead?.follow_up_date) {
        await leadsApi.update(id, { status: 'remainder' });
      }

      await notificationHelper.notifyUserAndAdmins(
        profile.id as string,
        'Follow-up Updated',
        `Follow-up for lead "${lead?.name}" has been set for ${new Date(followUpDate).toLocaleString()}.`,
        'info',
        'followup_updated',
        'lead',
        id
      );

      toast({
        title: 'Success',
        description: 'Follow-up scheduled & Syncing',
      });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'update_follow_up',
          resource_type: 'follow_up',
          resource_id: id,
          details: { follow_up_date: followUpDate },
        });
      }

      setFollowUpDate('');
      setFollowUpNotes('');
      setFollowUpStatus('pending');
      setFollowUpType('call');
      setEditingFollowUp(null);
      setShowFollowUpDialog(false);
      loadData();
    } catch (error) {
      console.error('Failed to save follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to save follow-up',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteFollowUp = async () => {
    if (!id) return;
    try {
      await followUpsApi.update(`fu-${id}`, { status: 'completed' });

      if (profile) {
        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Completed',
          `Follow-up for lead "${lead?.name}" has been marked as completed.`,
          'success',
          'followup_completed',
          'lead',
          id
        );
      }

      toast({
        title: 'Success',
        description: 'Follow-up marked as completed',
      });

      loadData();
    } catch (error) {
      console.error('Failed to complete follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFollowUp = async () => {
    if (!id) return;
    try {
      await followUpsApi.delete(`fu-${id}`);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_follow_up',
          resource_type: 'follow_up',
          resource_id: id,
          details: { action: 'removed' },
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Removed',
          `Follow-up for lead "${lead?.name}" has been removed.`,
          'warning',
          'followup_deleted',
          'lead',
          id
        );
      }

      toast({
        title: 'Success',
        description: 'Follow-up removed successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to remove follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove follow-up',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLead = async () => {
    if (!id) return;

    try {
      await leadsApi.delete(id);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_lead',
          resource_type: 'lead',
          resource_id: id,
          details: { lead_name: lead?.name },
        });

        await notificationHelper.notifyAdmins(
          'Lead Deleted',
          `Lead "${lead?.name}" has been deleted by ${profile.username}.`,
          'warning',
          'lead_deleted',
          'lead',
          id
        );
      }

      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      });

      navigate('/leads');
    } catch (error) {
      console.error('Failed to delete lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      });
    }
  };

  const openNewNoteDialog = () => {
    setEditingNote(null);
    setNewNote(lead?.notes || '');
    setNoteReason('');
    setNoteType('general');
    setShowNoteDialog(true);
  };

  const openNewFollowUpDialog = () => {
    setEditingFollowUp(null);
    setFollowUpDate(lead?.follow_up_date?.slice(0, 16) || '');
    setFollowUpNotes(lead?.notes || '');
    setFollowUpStatus(lead?.follow_up_status || 'pending');
    setFollowUpType(lead?.follow_up_type || 'call');
    setShowFollowUpDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Lead Not Found</h2>
          <p className="text-muted-foreground mb-4">The lead you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/leads')}>Back to Leads</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/leads')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leads
        </Button>
        {hasPermission('leads', 'write') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Lead
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this lead and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLead}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{lead.name}</CardTitle>
          <CardDescription>Lead Details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{lead.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Badge>{lead.source.replace(/_/g, ' ')}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={lead.status}
                onValueChange={(value) => handleUpdateLead('status', value)}
                disabled={!hasPermission('leads', 'write')}
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

            {lead.description && (
              <div className="space-y-2 md:col-span-2 mt-4 mb-4">
                <Label>Message / Description</Label>
                <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                  {lead.description}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={lead.assigned_to || 'unassigned'}
                onValueChange={(value) => handleUpdateLead('assigned_to', value)}
                disabled={!hasPermission('leads', 'write')}
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

            <div className="space-y-2">
              <Label>Created</Label>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(lead.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Notes</CardTitle>
              {hasPermission('leads', 'write') && !lead.notes && (
                <Button size="sm" onClick={openNewNoteDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!lead.notes ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes yet
                </p>
              ) : (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                    {hasPermission('leads', 'write') && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setNewNote(lead.notes || '');
                            setEditingNote({ id: 'dummy' }); // Set to object to show "Update"
                            setShowNoteDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Note?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will clear the lead notes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteNote}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Follow-up Reminder</CardTitle>
              {hasPermission('leads', 'write') && !lead.follow_up_date && (
                <Button size="sm" onClick={openNewFollowUpDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!lead.follow_up_date ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No follow-up scheduled
                </p>
              ) : (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {new Date(lead.follow_up_date).toLocaleString()}
                        </span>
                        {lead.follow_up_type && (
                          <Badge variant="outline" className="text-xs">
                            {lead.follow_up_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={lead.follow_up_status === 'completed' ? 'default' : 'secondary'}>
                          {lead.follow_up_status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                    {hasPermission('leads', 'write') && (
                      <div className="flex gap-2">
                        {lead.follow_up_status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCompleteFollowUp}
                            title="Mark as completed"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setFollowUpDate(lead.follow_up_date?.slice(0, 16) || '');
                            setFollowUpType(lead.follow_up_type || 'call');
                            setFollowUpStatus(lead.follow_up_status || 'pending');
                            setEditingFollowUp({ id: 'dummy' }); // Set to object to show "Edit"
                            setShowFollowUpDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Follow-up?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the follow-up reminder.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteFollowUp}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Add Note'}</DialogTitle>
            <DialogDescription>
              {editingNote ? 'Update the note details' : 'Add a new note to this lead'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note_type">Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="pending_reason">Pending Reason</SelectItem>
                  <SelectItem value="remainder_reason">Remainder Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="note_content">Content</Label>
              <Textarea
                id="note_content"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter note content..."
                rows={4}
              />
            </div>
            {(noteType === 'pending_reason' || noteType === 'remainder_reason') && (
              <div>
                <Label htmlFor="note_reason">Reason</Label>
                <Input
                  id="note_reason"
                  value={noteReason}
                  onChange={(e) => setNoteReason(e.target.value)}
                  placeholder="Enter reason..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>
              {editingNote ? 'Update' : 'Add'} Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFollowUp ? 'Edit Follow-up' : 'Schedule Follow-up'}</DialogTitle>
            <DialogDescription>
              {editingFollowUp ? 'Update the follow-up details' : 'Set a reminder to follow up with this lead'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="follow_up_date">Follow-up Date & Time</Label>
              <Input
                id="follow_up_date"
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="follow_up_type">Interaction Type</Label>
              <Select value={followUpType} onValueChange={setFollowUpType}>
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
            {editingFollowUp && (
              <div>
                <Label htmlFor="follow_up_status">Status</Label>
                <Select value={followUpStatus} onValueChange={setFollowUpStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="follow_up_notes">Notes</Label>
              <Textarea
                id="follow_up_notes"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Add notes for this follow-up..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFollowUp}>
              {editingFollowUp ? 'Update' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
