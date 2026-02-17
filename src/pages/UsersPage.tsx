import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export default function UsersPage() {
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
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            User management
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Role Mapping Guide</CardTitle>
            <CardDescription>How WordPress roles translate to App permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-3 text-left font-medium">WordPress Role</th>
                    <th className="p-3 text-left font-medium">App Access Role</th>
                    <th className="p-3 text-left font-medium">Capabilities</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Administrator</td>
                    <td className="p-3"><Badge>Admin</Badge></td>
                    <td className="p-3 text-muted-foreground">Full access to everything</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Editor</td>
                    <td className="p-3"><Badge variant="default" className="bg-purple-600">SEO Manager</Badge></td>
                    <td className="p-3 text-muted-foreground">Manage All Blogs & SEO Tags</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Author</td>
                    <td className="p-3"><Badge variant="secondary" className="bg-blue-600 text-white">Sales Manager</Badge></td>
                    <td className="p-3 text-muted-foreground">Manage All Leads</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Contributor</td>
                    <td className="p-3"><Badge variant="secondary">Sales Person</Badge></td>
                    <td className="p-3 text-muted-foreground">Manage Assigned Leads Only</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Custom: 'seo_person'</td>
                    <td className="p-3"><Badge variant="outline" className="border-purple-600 text-purple-600">SEO Person</Badge></td>
                    <td className="p-3 text-muted-foreground">Manage Assigned SEO/Blogs Only</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Subscriber</td>
                    <td className="p-3"><Badge variant="outline">Client</Badge></td>
                    <td className="p-3 text-muted-foreground">View Reports Only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Create users in WordPress Dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This application uses your existing WordPress user database. To add a new team member or client:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-2 ml-2">
              <li>Go to your <strong>WordPress Admin Dashboard</strong>.</li>
              <li>Navigate to <strong>Users {'>'} Add New</strong>.</li>
              <li>Fill in the details and select the appropriate <strong>Role</strong> based on the mapping table.</li>
              <li>Share the username and password with the user.</li>
              <li>
                The user can then log in here using their username and an
                <strong> Application Password</strong> (recommended) or their main password.
              </li>
            </ol>

            <div className="pt-4">
              <Button asChild className="w-full">
                <a
                  href="https://digitmarketus.com/Bhairavi/wp-admin/user-new.php"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Go to Add New User (WP Admin)
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
