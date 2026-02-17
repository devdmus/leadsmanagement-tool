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
import { ArrowLeft, Mail, Phone, Calendar, User, Trash2, Edit, Plus, Clock, CheckCircle } from 'lucide-react';
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
type LeadSource = 'facebook' | 'linkedin' | 'form' | 'seo';
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
  created_at: string;
  updated_at: string;
};

type Note = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  note_type?: string;
  reason?: string;
  created_at: string;
};

type FollowUp = {
  id: string;
  lead_id: string;
  user_id: string;
  follow_up_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  user?: Profile;
  type?: string;
};

type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

type NoteWithUser = Note & {
  user?: Profile;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState<LeadWithAssignee | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notes, setNotes] = useState<NoteWithUser[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNote, setNewNote] = useState('');
  const [noteReason, setNoteReason] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
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
      const [leadsData, usersData, notesData, followUpsData] = await Promise.all([
        leadsApi.getAll(),
        profilesApi.getAll(),
        notesApi.getByLeadId(id),
        followUpsApi.getByLead(id),
      ]);

      const leadData = leadsData.find((l: any) => l.id.toString() === id.toString());

      if (!leadData) {
        throw new Error('Lead not found');
      }

      const allUsers = usersData as Profile[];
      setLead({
        ...leadData,
        assignee: allUsers.find(u => u.id === leadData.assigned_to)
      } as LeadWithAssignee);
      setUsers(allUsers);
      setNotes(notesData as NoteWithUser[]);
      setFollowUps(followUpsData as FollowUp[]);
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

    try {
      const updateValue = value === 'unassigned' ? null : (value || null);
      await leadsApi.update(id, { [field]: updateValue });

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'update_lead',
          resource_type: 'lead',
          resource_id: id,
          details: { field, value },
        });

        // Notify user and admins
        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Lead Updated',
          `Lead "${lead?.name}" ${field} has been updated.`,
          'success',
          'lead_updated',
          'lead',
          id
        );

        // If assigning to someone, notify them
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
      }

      toast({
        title: 'Success',
        description: `Lead ${field} updated successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Failed to update lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to update lead',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNote = async () => {
    if (!id || !profile || !newNote.trim()) return;

    try {
      if (editingNote) {
        // Update existing note
        await notesApi.update(editingNote.id, {
          content: newNote,
          reason: noteReason || null,
          note_type: noteType,
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Note Updated',
          `Note on lead "${lead?.name}" has been updated.`,
          'success',
          'note_updated',
          'note',
          editingNote.id
        );

        toast({
          title: 'Success',
          description: 'Note updated successfully',
        });
      } else {
        // Create new note
        await notesApi.create({
          lead_id: id,
          user_id: profile.id as string,
          content: newNote,
          reason: noteReason || null,
          note_type: noteType,
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Note Added',
          `New note added to lead "${lead?.name}".`,
          'success',
          'note_created',
          'lead',
          id
        );

        toast({
          title: 'Success',
          description: 'Note added successfully',
        });
      }

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: editingNote ? 'update_note' : 'create_note',
          resource_type: 'note',
          resource_id: id,
          details: { content: newNote },
        });
      }

      setNewNote('');
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

  const handleDeleteNote = async (noteId: string) => {
    try {
      await notesApi.delete(noteId);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_note',
          resource_type: 'note',
          resource_id: id || '',
          details: { note_id: noteId },
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Note Deleted',
          `Note on lead "${lead?.name}" has been deleted.`,
          'warning',
          'note_deleted',
          'lead',
          id || ''
        );
      }

      toast({
        title: 'Success',
        description: 'Note deleted successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  const handleSaveFollowUp = async () => {
    if (!id || !profile || !followUpDate) return;

    try {
      if (editingFollowUp) {
        // Update existing follow-up
        await followUpsApi.update(editingFollowUp.id, {
          follow_up_date: followUpDate,
          notes: followUpNotes || undefined,
          status: followUpStatus,
          type: followUpType,
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Updated',
          `Follow-up for lead "${lead?.name}" has been updated.`,
          'success',
          'followup_updated',
          'followup',
          editingFollowUp.id
        );

        toast({
          title: 'Success',
          description: 'Follow-up updated successfully',
        });
      } else {
        // Create new follow-up
        const newFollowUp = await followUpsApi.create({
          lead_id: id,
          user_id: profile.id as string,
          follow_up_date: followUpDate,
          notes: followUpNotes || undefined,
          type: followUpType,
        });

        // Auto-update lead status to remainder
        await leadsApi.update(id, { status: 'remainder' });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Scheduled',
          `Follow-up scheduled for lead "${lead?.name}" on ${new Date(followUpDate).toLocaleString()}.`,
          'info',
          'followup_created',
          'followup',
          newFollowUp?.id || ''
        );

        toast({
          title: 'Success',
          description: 'Follow-up scheduled & Lead marked as Remainder',
        });
      }

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: editingFollowUp ? 'update_follow_up' : 'create_follow_up',
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

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      await followUpsApi.update(followUpId, { status: 'completed' });

      if (profile) {
        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Completed',
          `Follow-up for lead "${lead?.name}" has been marked as completed.`,
          'success',
          'followup_completed',
          'followup',
          followUpId
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

  const handleDeleteFollowUp = async (followUpId: string) => {
    try {
      await followUpsApi.delete(followUpId);

      if (profile) {
        await activityLogsApi.create({
          user_id: profile.id as string,
          action: 'delete_follow_up',
          resource_type: 'follow_up',
          resource_id: id || '',
          details: { followup_id: followUpId },
        });

        await notificationHelper.notifyUserAndAdmins(
          profile.id as string,
          'Follow-up Deleted',
          `Follow-up for lead "${lead?.name}" has been deleted.`,
          'warning',
          'followup_deleted',
          'lead',
          id || ''
        );
      }

      toast({
        title: 'Success',
        description: 'Follow-up deleted successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to delete follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete follow-up',
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

  const openEditNoteDialog = (note: Note) => {
    setEditingNote(note);
    setNewNote(note.content);
    setNoteReason(note.reason || '');
    setNoteType(note.note_type || 'general');
    setShowNoteDialog(true);
  };

  const openNewNoteDialog = () => {
    setEditingNote(null);
    setNewNote('');
    setNoteReason('');
    setNoteType('general');
    setShowNoteDialog(true);
  };

  const openEditFollowUpDialog = (followUp: FollowUp) => {
    setEditingFollowUp(followUp);
    setFollowUpDate(followUp.follow_up_date);
    setFollowUpNotes(followUp.notes || '');
    setFollowUpStatus(followUp.status);
    setFollowUpType(followUp.type || 'call');
    setShowFollowUpDialog(true);
  };

  const openNewFollowUpDialog = () => {
    setEditingFollowUp(null);
    setFollowUpDate('');
    setFollowUpNotes('');
    setFollowUpStatus('pending');
    setFollowUpType('call');
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
              <Badge>{lead.source}</Badge>
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
              {hasPermission('notes', 'write') && (
                <Button size="sm" onClick={openNewNoteDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes yet
                </p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm">{note.content}</p>
                        {note.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reason: {note.reason}
                          </p>
                        )}
                        {note.note_type && note.note_type !== 'general' && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {note.note_type.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      {hasPermission('notes', 'write') && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditNoteDialog(note)}
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
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{note.user?.username || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Follow-ups</CardTitle>
              {hasPermission('leads', 'write') && (
                <Button size="sm" onClick={openNewFollowUpDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No follow-ups scheduled
                </p>
              ) : (
                followUps.map((followUp) => (
                  <div key={followUp.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {new Date(followUp.follow_up_date).toLocaleString()}
                          </span>
                          {followUp.type && (
                            <Badge variant="outline" className="text-xs">
                              {followUp.type}
                            </Badge>
                          )}
                        </div>
                        {followUp.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{followUp.notes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={followUp.status === 'completed' ? 'default' : 'secondary'}>
                            {followUp.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {followUp.user?.username || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      {hasPermission('leads', 'write') && (
                        <div className="flex gap-2">
                          {followUp.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCompleteFollowUp(followUp.id)}
                              title="Mark as completed"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditFollowUpDialog(followUp)}
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
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteFollowUp(followUp.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                ))
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
