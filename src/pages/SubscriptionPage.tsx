import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export default function SubscriptionPage() {
  return (
    <div className="space-y-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground text-lg">
          Subscription management will be available soon.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Coming Soon
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              We are currently focusing on delivering a powerful
              <strong> Lead Management & CRM system</strong>.
            </p>

            <div className="flex justify-center gap-2">
              <Badge variant="outline">WordPress Backend</Badge>
              <Badge variant="outline">React Dashboard</Badge>
              <Badge variant="outline">Enterprise Ready</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Subscription plans, billing, and upgrades will be enabled
              once authentication & payments are finalized.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
