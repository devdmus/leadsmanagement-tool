import { useEffect, useState } from 'react';
import { MessageSquare, X, Send, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { chatApi, profilesApi } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
};

type ChatRoom = {
  id: string;
  name: string | null;
  is_group: boolean;
  participants?: {
    user: {
      id: string;
      username: string;
      role: string;
    };
  }[];
};

type Profile = {
  id: string;
  username: string;
  role: string;
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { profile } = useAuth();
  const { toast } = useToast();

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      loadUsers().then(() => loadRooms());
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);

      const channel = chatApi.subscribeToMessages(selectedRoom.id, () => {
        loadMessages(selectedRoom.id);
      });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [selectedRoom]);

  const loadRooms = async () => {
    try {
      const data = await chatApi.getRooms();
      const mappedRooms = data.map((room: any) => ({
        id: room.id,
        name: room.name || null,
        is_group: room.users.length > 2,
        participants: room.users.map((uid: string) => ({
          user: users.find(u => u.id === uid) || { id: uid, username: 'User', role: 'member' }
        }))
      }));
      setRooms(mappedRooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await profilesApi.getAll();
      setUsers(data.filter((u: Profile) => u.id !== profile?.id) as Profile[]);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const data = await chatApi.getMessages(roomId);
      setMessages(data as ChatMessage[]);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom) return;

    try {
      await chatApi.sendMessage(selectedRoom.id, newMessage);
      setNewMessage('');
      loadMessages(selectedRoom.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleCreateChat = async (userIds?: string[]) => {
    const targetUsers = userIds || selectedUsers;
    if (targetUsers.length === 0) return;

    try {
      const currentUserId = (profile?.id as string) || '';
      if (!currentUserId) return;

      const roomUsers: string[] = [...targetUsers, currentUserId];
      const room = await chatApi.createRoom(roomUsers);

      const newRoom: ChatRoom = {
        id: room.id,
        name: null,
        is_group: roomUsers.length > 2,
        participants: roomUsers.map(uid => {
          if (uid === currentUserId) {
            return {
              user: {
                id: uid,
                username: 'You',
                role: String(profile?.role || 'user')
              }
            };
          }
          const found = users.find(u => u.id === uid);
          return {
            user: found || { id: uid, username: 'User', role: 'member' }
          };
        })
      };

      setShowNewChat(false);
      setSelectedUsers([]);
      setRooms([newRoom, ...rooms]);
      setSelectedRoom(newRoom);

      toast({
        title: 'Success',
        description: 'Chat created successfully',
      });
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to create chat',
        variant: 'destructive',
      });
    }
  };

  const getRoomName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (room.participants && room.participants.length > 0) {
      const otherParticipants = room.participants.filter(p => p.user.id !== profile?.id);
      return otherParticipants.map(p => p.user.username).join(', ');
    }
    return 'Chat';
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>

      {isOpen && (
        <Card className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 w-auto sm:w-96 h-[65vh] sm:h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Team Chat</CardTitle>
              <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                </DialogTrigger>
                <DialogContent className="z-[100]">
                  <DialogHeader>
                    <DialogTitle>Start New Chat</DialogTitle>
                    <DialogDescription>
                      Select users to start a conversation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mb-2"
                        />
                        {filteredUsers.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{user.username}</p>
                                <Badge variant="secondary" className="text-xs">{user.role}</Badge>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button onClick={() => handleCreateChat()} className="w-full" disabled={selectedUsers.length === 0}>
                      Create Group Chat
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {!selectedRoom ? (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {rooms.length === 0 ? (
                    <div className="space-y-4">

                      {users.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground">No other users found.</div>
                      ) : (
                        <>
                          <p className="text-center text-muted-foreground text-sm py-2">Start a conversation:</p>
                          <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="mb-2"
                          />
                          {filteredUsers.length === 0 ? (
                            <div className="text-center text-xs text-muted-foreground">No users found.</div>
                          ) : (
                            filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer border transition-colors"
                                onClick={() => handleCreateChat([user.id])}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{user.username}</p>
                                  <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <Input
                          placeholder="Search chats or users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && filteredUsers.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground px-2">New Chats</p>
                            {filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer border transition-colors"
                                onClick={() => {
                                  handleCreateChat([user.id]);
                                  setSearchQuery('');
                                }}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{user.username}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {searchQuery && rooms.some(r => getRoomName(r).toLowerCase().includes(searchQuery.toLowerCase())) && (
                        <p className="text-xs font-semibold text-muted-foreground px-2 mb-2">Recent Chats</p>
                      )}

                      {rooms
                        .filter(room => getRoomName(room).toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((room) => (
                          <div
                            key={room.id}
                            onClick={() => setSelectedRoom(room)}
                            className="p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>
                                  {getRoomName(room).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{getRoomName(room)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {room.is_group ? 'Group Chat' : 'Direct Message'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <>
                <div className="border-b p-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRoom(null)}
                  >
                    ← Back
                  </Button>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getRoomName(selectedRoom)}</p>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwn = message.user_id === profile?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                            {!isOwn && (
                              <p className="text-xs text-muted-foreground mb-1">
                                {message.user?.username}
                              </p>
                            )}
                            <div
                              className={`rounded-lg p-3 ${isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                                }`}
                            >
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="border-t p-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
