import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/common/NotificationCenter';
import { useNavigate } from 'react-router-dom';
import { useSite } from '@/contexts/SiteContext';
import { SiteSwitcher } from '@/components/common/SiteSwitcher';

type Profile = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  is_client_paid: boolean;
  created_at: string;
  updated_at: string;
};


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AppSidebar } from './AppSidebar';

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { currentSite, setCurrentSite, getAccessibleSites, canSwitchSites } = useSite();
  const navigate = useNavigate();
  const accessibleSites = profile ? getAccessibleSites(String((profile as Profile).id), String((profile as Profile).role)) : [];
  const showSiteSwitcher = profile ? canSwitchSites(String((profile as Profile).id), String((profile as Profile).role)) : false;

  const handleSignOut = async () => {
    await signOut();
  };



  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-gradient-to-b from-[#1F86E0] to-[#0A4F8B]">
      <div className="flex h-16 items-center px-4 md:px-6 gap-4">
        {/* Mobile Sidebar (Sheet) */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-r-0">
              <AppSidebar />
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Sidebar Toggle - MOVED TO SIDEBAR EDGE */}

        {/* Breadcrumbs or Page Title could go here */}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {showSiteSwitcher && (
            <SiteSwitcher
              accessibleSites={accessibleSites}
              currentSite={currentSite}
              setCurrentSite={(id) => setCurrentSite(String(id))}
            />
          )}
          <NotificationCenter />

          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 gap-2 hover:bg-white/40 ">
                  <Avatar className="h-8 w-8 ">
                    {/* changed css  */}
                    <AvatarFallback className="bg-[#ff0000] text-primary-foreground">
                      {(profile as Profile).username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    {/* changed css */}
                    <span className="text-sm font-medium text-white/90">{(profile as Profile).username}</span>
                    {/* <Badge variant="secondary" className={cn('text-xs', getRoleColor((profile as Profile).role))}>
                      {(profile as Profile).role}
                    </Badge> */}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

