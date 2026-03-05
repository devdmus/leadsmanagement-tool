import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function PermissionsPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          You do not have permission to access this page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Role Permissions</h1>
        <p className="text-muted-foreground">
          Role-based access control
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Advanced role permissions will be managed using
            <strong> WordPress Roles & Capabilities</strong>.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">Admin</Badge>
            <Badge variant="outline">Sales</Badge>
            <Badge variant="outline">SEO</Badge>
            <Badge variant="outline">Client</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Planned features:
          </p>

          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Read / Write permissions per feature</li>
            <li>Lead visibility controls</li>
            <li>Activity audit enforcement</li>
            <li>Admin-only configuration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
