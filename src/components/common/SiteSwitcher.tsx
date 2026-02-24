import { useState } from 'react';
import { Globe, ChevronDown, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SiteOption {
  id: string | number;
  name: string;
  url?: string;
}

interface SiteSwitcherProps {
  accessibleSites: SiteOption[];
  currentSite: SiteOption | null;
  setCurrentSite: (id: string) => void;
  isCollapsed?: boolean;
}

export function SiteSwitcher({
  accessibleSites,
  currentSite,
  setCurrentSite,
  isCollapsed = false,
}: SiteSwitcherProps) {
  const { signInWithUsername, hasSiteCredentials, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  // State for the re-login dialog (shown when switching to a site with no saved creds)
  const [pendingSite, setPendingSite] = useState<SiteOption | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (accessibleSites.length === 0 || isCollapsed) return null;

  const handleSiteClick = async (site: SiteOption) => {
    if (site.id === currentSite?.id) return;

    const siteId = String(site.id);

    // If we already have credentials for this site (or we are a super admin with system-level creds), switch silently
    if (hasSiteCredentials(siteId)) {
      setCurrentSite(siteId);
      toast({
        title: 'Site Switched',
        description: `Now working with ${site.name}`,
      });
      return;
    }

    // No saved credentials — show the login dialog for this site
    setPendingSite(site);
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleLoginForSite = async () => {
    if (!pendingSite) return;
    setIsLoggingIn(true);

    const { error } = await signInWithUsername(loginUsername, loginPassword, String(pendingSite.id));

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Switch to the new site now that we have credentials
      setCurrentSite(String(pendingSite.id));
      toast({
        title: 'Site Switched',
        description: `Now working with ${pendingSite.name}`,
      });
      setPendingSite(null);
    }

    setIsLoggingIn(false);
  };

  return (
    <>
      <div className="px-4 py-3 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between bg-white/10 hover:bg-white/20 !text-white border border-white/20 backdrop-blur-sm h-12 rounded-xl transition-all duration-300 group shadow-lg"
            >
              <span className="flex items-center gap-2.5 truncate">
                <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                  <Globe className="h-4 w-4 flex-shrink-0" />
                </div>
                <span className="truncate font-medium text-white">
                  {currentSite?.name || 'Select Site'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-[15rem] p-2 bg-white/95 backdrop-blur-xl border-white/20 shadow-xl rounded-xl"
          >
            {accessibleSites.map((site) => {
              const siteId = String(site.id);
              const hasCreds = hasSiteCredentials(siteId);
              const isActive = currentSite?.id === site.id;

              return (
                <DropdownMenuItem
                  key={site.id}
                  onClick={() => handleSiteClick(site)}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-2.5 my-0.5 font-medium transition-colors',
                    isActive
                      ? 'bg-[#ff0000] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Globe className="mr-2 h-4 w-4 opacity-70 flex-shrink-0" />
                  <span className="truncate flex-1">{site.name}</span>
                  {/* Show key icon if no credentials saved and not active */}
                  {!hasCreds && !isActive && !isSuperAdmin && (
                    <KeyRound className="ml-2 h-3 w-3 opacity-50 flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Re-login Dialog — shown when switching to a site with no saved credentials */}
      <Dialog open={!!pendingSite} onOpenChange={(open) => { if (!open) setPendingSite(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#1F86E0]" />
              Sign in to {pendingSite?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your WordPress credentials for{' '}
              <span className="font-medium text-foreground">{pendingSite?.name}</span>.
              These will be saved so you won't need to re-enter them next time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sw-username">Username</Label>
              <Input
                id="sw-username"
                placeholder="WordPress username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-password">Application Password</Label>
              <Input
                id="sw-password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={isLoggingIn}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLoginForSite(); }}
              />
              <p className="text-xs text-muted-foreground">
                Generate in WP Admin → Users → Profile → Application Passwords
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingSite(null)}
              disabled={isLoggingIn}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLoginForSite}
              disabled={isLoggingIn || !loginUsername || !loginPassword}
              className="bg-[#1F86E0] hover:bg-[#166db8]"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In & Switch'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
