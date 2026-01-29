-- Add follow-up system
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  follow_up_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add internal chat system
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add theme preferences to profiles
ALTER TABLE profiles ADD COLUMN theme_color TEXT DEFAULT 'blue';
ALTER TABLE profiles ADD COLUMN sidebar_collapsed BOOLEAN DEFAULT false;

-- Add reason field to notes
ALTER TABLE notes ADD COLUMN reason TEXT;
ALTER TABLE notes ADD COLUMN note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'pending_reason', 'remainder_reason'));

-- Drop messages table as we're removing it
DROP TABLE IF EXISTS messages CASCADE;

-- Create indexes
CREATE INDEX idx_follow_ups_lead ON follow_ups(lead_id);
CREATE INDEX idx_follow_ups_user ON follow_ups(user_id);
CREATE INDEX idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_chat_participants_room ON chat_participants(room_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);

-- Add triggers
CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for follow_ups
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follow-ups for their assigned leads" ON follow_ups
  FOR SELECT TO authenticated USING (
    is_admin(auth.uid()) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM leads WHERE leads.id = follow_ups.lead_id AND leads.assigned_to = auth.uid())
  );

CREATE POLICY "Users can create follow-ups for their assigned leads" ON follow_ups
  FOR INSERT TO authenticated WITH CHECK (
    is_admin(auth.uid()) OR 
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own follow-ups" ON follow_ups
  FOR UPDATE TO authenticated USING (
    is_admin(auth.uid()) OR user_id = auth.uid()
  );

CREATE POLICY "Admins can delete follow-ups" ON follow_ups
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- RLS Policies for chat_rooms
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms they participate in" ON chat_rooms
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.room_id = chat_rooms.id AND chat_participants.user_id = auth.uid())
  );

CREATE POLICY "Users can create chat rooms" ON chat_rooms
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- RLS Policies for chat_participants
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants in their rooms" ON chat_participants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.room_id = chat_participants.room_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Users can add participants to rooms they created" ON chat_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.id = room_id AND chat_rooms.created_by = auth.uid())
  );

-- RLS Policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their rooms" ON chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.room_id = chat_messages.room_id AND chat_participants.user_id = auth.uid())
  );

CREATE POLICY "Users can send messages to their rooms" ON chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_participants.room_id = chat_messages.room_id AND chat_participants.user_id = auth.uid())
  );

-- Insert sample follow-ups
INSERT INTO follow_ups (lead_id, user_id, follow_up_date, status, notes)
SELECT l.id, l.assigned_to, NOW() + INTERVAL '2 days', 'pending', 'Initial follow-up call scheduled'
FROM leads l WHERE l.status = 'pending' AND l.assigned_to IS NOT NULL
LIMIT 5;

-- Insert sample notes with reasons
INSERT INTO notes (lead_id, user_id, content, note_type, reason)
SELECT l.id, l.assigned_to, 'Lead is interested but needs more time to decide', 'pending_reason', 'Awaiting decision'
FROM leads l WHERE l.status = 'pending' AND l.assigned_to IS NOT NULL
LIMIT 3;

INSERT INTO notes (lead_id, user_id, content, note_type, reason)
SELECT l.id, l.assigned_to, 'Need to follow up next week after their budget meeting', 'remainder_reason', 'Budget approval pending'
FROM leads l WHERE l.status = 'remainder' AND l.assigned_to IS NOT NULL
LIMIT 2;