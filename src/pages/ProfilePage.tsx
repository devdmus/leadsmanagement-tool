import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User as UserIcon } from 'lucide-react';

export default function ProfilePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Profile not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {profile.username || 'User'}
              </CardTitle>
              <Badge variant="outline">
                {profile.role || 'user'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
            <span>Email:</span>
            <span className="text-muted-foreground">
              {profile.email || 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              Joined on{' '}
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : '—'}
            </span>
          </div>

          <div className="border-t pt-4 text-sm text-muted-foreground">
            Profile editing, password change, and notifications will be
            enabled once WordPress authentication is finalized.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
