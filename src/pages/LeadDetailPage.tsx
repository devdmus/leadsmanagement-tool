import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadsApi, profilesApi, notesApi, messagesApi, activityLogsApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
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

type Note = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type Message = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type LeadWithAssignee = Lead & {
  assignee?: Profile | null;
};

type NoteWithUser = Note & {
  user?: Profile;
};

type MessageWithUser = Message & {
  user?: Profile;
};
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
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, Phone, Calendar, User, Trash2 } from 'lucide-react';
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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState<LeadWithAssignee | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notes, setNotes] = useState<NoteWithUser[]>([]);
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNote, setNewNote] = useState('');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [leadData, usersData, notesData, messagesData] = await Promise.all([
        leadsApi.getById(id),
        profilesApi.getAll(),
        notesApi.getByLeadId(id),
        messagesApi.getByLeadId(id),
      ]);

      setLead(leadData);
      setUsers(usersData);
      setNotes(notesData);
      setMessages(messagesData);
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
      }

      toast({
        title: 'Success',
        description: 'Lead updated successfully',
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

  const handleAddNote = async () => {
    if (!id || !profile || !newNote.trim()) return;

    if (!hasPermission('notes', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to add notes',
        variant: 'destructive',
      });
      return;
    }

    try {
      await notesApi.create({
        lead_id: id,
        user_id: profile.id as string,
        content: newNote,
      });

      await activityLogsApi.create({
        user_id: profile.id as string,
        action: 'add_note',
        resource_type: 'lead',
        resource_id: id,
        details: null,
      });

      toast({
        title: 'Success',
        description: 'Note added successfully',
      });

      setNewNote('');
      loadData();
    } catch (error) {
      console.error('Failed to add note:', error);
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  const handleAddMessage = async () => {
    if (!id || !profile || !newMessage.trim()) return;

    if (!hasPermission('messages', 'write')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to send messages',
        variant: 'destructive',
      });
      return;
    }

    try {
      await messagesApi.create({
        lead_id: id,
        user_id: profile.id as string,
        content: newMessage,
      });

      await activityLogsApi.create({
        user_id: profile.id as string,
        action: 'send_message',
        resource_type: 'lead',
        resource_id: id,
        details: null,
      });

      toast({
        title: 'Success',
        description: 'Message sent successfully',
      });

      setNewMessage('');
      loadData();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLead = async () => {
    if (!id || !hasPermission('leads', 'write')) return;

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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 bg-muted" />
          <Skeleton className="h-64 bg-muted" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Lead not found</p>
        <Button onClick={() => navigate('/leads')} className="mt-4">
          Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{lead.name}</h1>
            <p className="text-muted-foreground">Lead Details</p>
          </div>
        </div>
        {hasPermission('leads', 'write') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Lead
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the lead and all associated notes and messages.
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{lead.email}</span>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{lead.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Created: {new Date(lead.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Updated: {new Date(lead.updated_at).toLocaleString()}</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Source</Label>
              <Badge variant="outline">{lead.source.toUpperCase()}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {lead.assignee && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{lead.assignee.username}</p>
                  <p className="text-xs text-muted-foreground">{lead.assignee.role}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Internal notes for this lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('notes', 'write') && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                  Add Note
                </Button>
              </div>
            )}

            <Separator />

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-3 bg-muted rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{note.user?.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Internal conversations about this lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-md space-y-1 ${
                      message.user_id === profile?.id
                        ? 'bg-primary text-primary-foreground ml-8'
                        : 'bg-muted mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{message.user?.username}</span>
                      <span className="text-xs opacity-70">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))
              )}
            </div>

            {hasPermission('messages', 'write') && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddMessage();
                      }
                    }}
                  />
                  <Button onClick={handleAddMessage} disabled={!newMessage.trim()}>
                    Send Message
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
