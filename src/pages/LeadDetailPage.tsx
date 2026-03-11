import { useEffect, useState } from 'react';
import { UserSearchSelect } from '@/components/common/UserSearchSelect';
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
import { ArrowLeft, Mail, Phone, Calendar, Trash2, Edit, Plus, Clock, CheckCircle, Loader2, MoreHorizontal, Eye, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
};

// Simplified types
type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  // Only these roles can delete leads or reassign them
  const canDeleteLead = ['super_admin', 'admin', 'seo_manager'].includes(profile?.role || '');
  const canAssignLead = ['super_admin', 'admin', 'seo_manager'].includes(profile?.role || '');

  const [lead, setLead] = useState<LeadWithAssignee | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);

  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [viewingNote, setViewingNote] = useState<any | null>(null);
  const [viewingFollowUp, setViewingFollowUp] = useState<any | null>(null);

  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('pending');
  const [followUpType, setFollowUpType] = useState('call');

  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [leadData, usersData, notesData, followUpsData] = await Promise.all([
        leadsApi.getById(id),
        profilesApi.getAll(),
        notesApi.getByLeadId(id),
        followUpsApi.getByLeadId(id),
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
      setNotes(notesData || []);
      setFollowUps(followUpsData || []);
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

            if (field === 'assigned_to' && updateValue) {
              await notificationHelper.notifyAssignment(
                updateValue,
                'New Lead Assigned',
                `You have been assigned to lead "${lead?.name}".`,
                'info',
                'lead_assigned',
                'lead',
                id
              );
            } else {
              await notificationHelper.notifyAdmins(
                'Lead Updated',
                `Lead "${lead?.name}" ${field} has been updated.`,
                'success',
                'lead_updated',
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

    setIsSavingNote(true);
    try {
      if (editingNote?.id && editingNote.id !== 'dummy') {
        await notesApi.update(id, editingNote.id, {
          content: newNote,
          note_type: 'general',
        });
      } else {
        await notesApi.create(id, {
          content: newNote,
          note_type: 'general',
          created_by: profile.id
        });
      }

      toast({
        title: 'Success',
        description: `Note ${editingNote ? 'updated' : 'added'} successfully`,
      });

      setNewNote('');
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
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;
    try {
      await notesApi.delete(id, noteId);
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

    setIsSavingFollowUp(true);
    try {
      if (editingFollowUp?.id && editingFollowUp.id !== 'dummy') {
        await followUpsApi.update(id, editingFollowUp.id, {
          follow_up_date: followUpDate,
          notes: followUpNotes || undefined,
          status: followUpStatus,
          type: followUpType,
        });
      } else {
        await followUpsApi.create(id, {
          follow_up_date: followUpDate,
          notes: followUpNotes || undefined,
          status: followUpStatus,
          type: followUpType,
          created_by: profile.id
        });
      }

      toast({
        title: 'Success',
        description: `Follow-up ${editingFollowUp ? 'updated' : 'scheduled'}`,
      });

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
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!id) return;
    try {
      await followUpsApi.update(id, followUpId, { status: 'completed' });
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
    if (!id) return;
    try {
      await followUpsApi.delete(id, followUpId);
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
    setNewNote('');
    setShowNoteDialog(true);
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
        {canDeleteLead && (
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
        <CardHeader className="space-y-2 pb-6">
          <CardDescription className="flex items-center gap-2">

            <span className="inline-block text-lg font-bold tracking-[0.1em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_auto] animate-gradient">
              Lead Profile
            </span>
            <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
          </CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground capitalize">
            {lead.name}
          </CardTitle>
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
              <UserSearchSelect
                users={users}
                value={lead.assigned_to || 'unassigned'}
                onValueChange={(value) => handleUpdateLead('assigned_to', value)}
                disabled={!canAssignLead}
              />
            </div>

            <div className="space-y-2">
              <Label>Created</Label>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(lead.created_at + (lead.created_at.includes('Z') ? '' : 'Z')).toLocaleDateString()},{' '}
                  {new Date(lead.created_at + (lead.created_at.includes('Z') ? '' : 'Z')).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Notes</CardTitle>
              {hasPermission('leads', 'write') && (
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
                notes.map(note => (
                  <div key={note.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground truncate">{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p
                          className="text-sm"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {note.content}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingNote(note)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Note
                          </DropdownMenuItem>
                          {hasPermission('leads', 'write') && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setNewNote(note.content || '');
                                  setEditingNote(note);
                                  setShowNoteDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
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
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Follow-up Reminders</CardTitle>
              {hasPermission('leads', 'write') && (
                <Button size="sm" onClick={openNewFollowUpDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No follow-ups scheduled
                </p>
              ) : (
                followUps.map(fu => (
                  <div key={fu.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {new Date(fu.follow_up_date).toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {fu.type}
                          </Badge>
                        </div>
                        {fu.notes && (
                          <>
                            <p
                              className="text-sm mt-2 text-muted-foreground mb-1 border-l-2 pl-2"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                              }}
                            >
                              {fu.notes}
                            </p>
                            {/* <button
                              className="text-xs text-primary hover:underline mb-3 flex items-center gap-1"
                              onClick={() => setViewingFollowUp(fu)}
                            >
                              <Eye className="h-3 w-3" /> View note
                            </button> */}
                          </>
                        )}
                        <Badge variant={fu.status === 'completed' ? 'default' : fu.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">
                          {fu.status}
                        </Badge>
                      </div>
                      {hasPermission('leads', 'write') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingFollowUp(fu)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Follow-up
                            </DropdownMenuItem>
                            {fu.status !== 'completed' && (
                              <DropdownMenuItem onClick={() => handleCompleteFollowUp(fu.id)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as completed
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setFollowUpDate(fu.follow_up_date?.slice(0, 16) || '');
                                setFollowUpType(fu.type || 'call');
                                setFollowUpStatus(fu.status || 'pending');
                                setFollowUpNotes(fu.notes || '');
                                setEditingFollowUp(fu);
                                setShowFollowUpDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
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
                                  <AlertDialogAction onClick={() => handleDeleteFollowUp(fu.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Follow-up Dialog */}
      <Dialog open={!!viewingFollowUp} onOpenChange={(open) => !open && setViewingFollowUp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up Details</DialogTitle>
            {viewingFollowUp && (
              <DialogDescription>
                <span className="capitalize">{viewingFollowUp.type}</span>
                {' · '}{new Date(viewingFollowUp.follow_up_date).toLocaleString()}
                {' · '}
                <span className="capitalize">{viewingFollowUp.status}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {viewingFollowUp?.notes && (
            <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {viewingFollowUp.notes}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFollowUp(null)}>Close</Button>
            {hasPermission('leads', 'write') && viewingFollowUp && (
              <Button
                onClick={() => {
                  setFollowUpDate(viewingFollowUp.follow_up_date?.slice(0, 16) || '');
                  setFollowUpType(viewingFollowUp.type || 'call');
                  setFollowUpStatus(viewingFollowUp.status || 'pending');
                  setFollowUpNotes(viewingFollowUp.notes || '');
                  setEditingFollowUp(viewingFollowUp);
                  setViewingFollowUp(null);
                  setShowFollowUpDialog(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Follow-up
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Note Details</DialogTitle>
            {viewingNote && (
              <DialogDescription>
                <span className="capitalize">{viewingNote.note_type?.replace(/_/g, ' ')}</span>
                {' · '}{new Date(viewingNote.created_at).toLocaleString()}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewingNote && (
            <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {viewingNote.content}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingNote(null)}>Close</Button>
            {hasPermission('leads', 'write') && viewingNote && (
              <Button
                onClick={() => {
                  setNewNote(viewingNote.content || '');
                  setEditingNote(viewingNote);
                  setViewingNote(null);
                  setShowNoteDialog(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Note
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="note_content">Content</Label>
              <Textarea className="my-2"
                id="note_content"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter note content..."
                rows={4}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)} disabled={isSavingNote}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSavingNote}>
              {isSavingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                min={new Date().toISOString().slice(0, 16)}
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
              <Textarea className="my-2"
                id="follow_up_notes"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Add notes for this follow-up..."
                rows={3}
                style={{ wordBreak: 'break-word', overflowX: 'hidden', resize: 'vertical' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)} disabled={isSavingFollowUp}>
              Cancel
            </Button>
            <Button onClick={handleSaveFollowUp} disabled={isSavingFollowUp}>
              {isSavingFollowUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFollowUp ? 'Update' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
