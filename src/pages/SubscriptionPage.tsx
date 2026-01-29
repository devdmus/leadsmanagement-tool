import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionPlansApi } from '@/db/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

type SubscriptionPlan = {
  id: string;
  name: string;
  plan_type: 'monthly' | 'quarterly' | 'annual';
  price: number;
  features: {
    leads_limit: number;
    users_limit: number;
    seo_pages_limit: number;
    support: string;
    analytics: boolean;
    api_access: boolean;
    custom_reports?: boolean;
    discount?: string;
  };
  is_active: boolean;
};

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, [profile]);

  const loadPlans = async () => {
    try {
      const plansData = await subscriptionPlansApi.getAll();
      setPlans(plansData as SubscriptionPlan[]);

      if (profile) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_plan_id')
          .eq('id', profile.id as string)
          .maybeSingle();

        if (profileData) {
          const planId = (profileData as { subscription_plan_id?: string }).subscription_plan_id;
          if (planId) {
            setCurrentPlanId(planId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription plans',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!profile) return;

    try {
      const startDate = new Date();
      const endDate = new Date();
      const plan = plans.find(p => p.id === planId);

      if (plan?.plan_type === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan?.plan_type === 'quarterly') {
        endDate.setMonth(endDate.getMonth() + 3);
      } else if (plan?.plan_type === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await subscriptionPlansApi.updateProfileSubscription(
        profile.id as string,
        planId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      toast({
        title: 'Success',
        description: 'Subscription activated successfully!',
      });

      loadPlans();
    } catch (error) {
      console.error('Failed to subscribe:', error);
      toast({
        title: 'Error',
        description: 'Failed to activate subscription',
        variant: 'destructive',
      });
    }
  };

  const getPlanBadge = (planType: string) => {
    if (planType === 'annual') {
      return (
        <Badge className="bg-primary text-primary-foreground">
          <Sparkles className="mr-1 h-3 w-3" />
          Best Value
        </Badge>
      );
    }
    if (planType === 'quarterly') {
      return <Badge className="bg-secondary text-secondary-foreground">Popular</Badge>;
    }
    return null;
  };

  const getPlanDuration = (planType: string) => {
    switch (planType) {
      case 'monthly':
        return '/month';
      case 'quarterly':
        return '/3 months';
      case 'annual':
        return '/year';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground">
          Select the perfect plan for your marketing needs
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlanId === plan.id;
          const isPopular = plan.plan_type === 'annual';

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPopular ? 'border-primary shadow-lg scale-105' : ''
              } ${isCurrentPlan ? 'border-success' : ''}`}
            >
              {getPlanBadge(plan.plan_type) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {getPlanBadge(plan.plan_type)}
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">
                  {plan.plan_type.charAt(0).toUpperCase() + plan.plan_type.slice(1)} billing
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">{getPlanDuration(plan.plan_type)}</span>
                </div>
                {plan.features.discount && (
                  <Badge variant="outline" className="mt-2">
                    {plan.features.discount}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Up to <strong>{plan.features.leads_limit}</strong> leads per month
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{plan.features.users_limit}</strong> team members
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{plan.features.seo_pages_limit}</strong> SEO pages
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-sm">{plan.features.support} support</span>
                  </div>
                  {plan.features.analytics && (
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <span className="text-sm">Advanced analytics</span>
                    </div>
                  )}
                  {plan.features.api_access && (
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <span className="text-sm">API access</span>
                    </div>
                  )}
                  {plan.features.custom_reports && (
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <span className="text-sm">Custom reports</span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    Subscribe Now
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, PayPal, and bank transfers for annual plans.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! All new users get a 14-day free trial with full access to all features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
