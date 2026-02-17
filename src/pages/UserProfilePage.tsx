import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User as UserIcon } from 'lucide-react';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  if (!hasPermission('users', 'read')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          You do not have permission to access this page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/users')}>
          ← Back to Users
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">User Profile</CardTitle>
              <Badge variant="outline">ID: {id}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Detailed user profiles will be available once
            WordPress user management is integrated.
          </p>

          <div className="border-t pt-4 text-sm text-muted-foreground space-y-1">
            <p>• Role management</p>
            <p>• Client subscription status</p>
            <p>• Profile editing</p>
            <p>• Audit trail</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Coming soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
