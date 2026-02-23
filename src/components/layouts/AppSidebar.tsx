import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
import { cn } from '@/lib/utils';
import type { UserRole, Profile } from '../../types/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from "react";
import Dmuslogo from '../../../public/images/logo/dmus-logo.png';

import {
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Settings,
  Shield,
  BookOpen,
  Globe,
  LogOut,
  PanelLeft
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'sales_manager', 'sales_person', 'seo_manager', 'seo_person', 'client'] as UserRole[] },
  { name: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'sales_manager', 'sales_person', 'client'] as UserRole[] },
  { name: 'SEO Meta Tags', href: '/seo', icon: Search, roles: ['admin', 'seo_manager', 'seo_person'] as UserRole[] },
  { name: 'Blogs', href: '/blogs', icon: BookOpen, roles: ['admin', 'seo_manager', 'seo_person'] as UserRole[] },
  { name: 'Sites', href: '/sites', icon: Globe, roles: ['admin'] as UserRole[] },
  { name: 'IP Security', href: '/ip-security', icon: Shield, roles: ['admin'] as UserRole[] },
  { name: 'Subscription', href: '/subscription', icon: FileText, roles: ['client'] as UserRole[] },
  { name: 'User Management', href: '/users', icon: Settings, roles: ['admin'] as UserRole[] },
  { name: 'Activity Logs', href: '/activity', icon: FileText, roles: ['admin', 'sales_manager', 'seo_manager'] as UserRole[] },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
}

export function AppSidebar({ isCollapsed = false, toggleSidebar }: AppSidebarProps) {

  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const { profile, signOut } = useAuth();
  // useSite kept so SiteContext stays available to child pages via context
  useSite();

  const filteredNavigation = navigation.filter(item =>
    profile && item.roles.includes((profile as Profile).role as UserRole)
  );

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col bg-gradient-to-b from-[#1F86E0] to-[#0A4F8B] text-white shadow-2xl relative transition-all duration-300 h-screen",
        isCollapsed ? "w-[80px]" : "w-72"
      )}
      style={{ position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 30 }}
    >

      {/* HEADER */}
      <div className={cn(
        "flex h-20 items-center flex-shrink-0 transition-all duration-300",
        isCollapsed ? "justify-center px-6" : "justify-between px-6"
      )}>

        <div className="flex items-center w-full relative">

          {/* LOGO */}
          {(!isCollapsed || (isCollapsed && !isHovered)) && (
            <div className={cn(
              "flex items-center justify-center transition-all duration-300",
              !isCollapsed && "p-2 bg-white/15 rounded-xl backdrop-blur-md border border-white/20 shadow-lg"
            )}>
              <img
                src={Dmuslogo}
                alt="DMUS Logo"
                className={cn(
                  "object-contain transition-all duration-300",
                  isCollapsed ? "h-12 w-12" : "h-11 w-auto"
                )}
              />
            </div>
          )}

          {/* TOGGLE BUTTON */}
          {(!isCollapsed || (isCollapsed && isHovered)) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn(
                "text-white hover:bg-white/10 transition-all duration-300  ",
                !isCollapsed && "ml-auto"
              )}
            >
              <PanelLeft className="h-8 w-8 " />
            </Button>
          )}

        </div>
      </div>
      <div
        className={cn(
          "flex-1 px-4 py-2 transition-all duration-300 sidebar-scroll-container",
          isHovered ? "overflow-y-auto" : "overflow-y-hidden"
        )}
      >
        <nav className="space-y-1.5">
          <TooltipProvider delayDuration={0}>
            <AnimatePresence>
              {filteredNavigation.map((item, index) => {
                const isActive = location.pathname === item.href;

                const content = (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={item.href}>
                      <div
                        className={cn(
                          'relative flex items-center rounded-xl transition-all duration-300 group overflow-hidden',
                          isActive
                            // changed color and bg for active state to match new design
                            ? 'text-white bg-[#ff0000] shadow-lg font-semibold scale-[1.02]'
                            : 'text-white/90 hover:bg-white/10 hover:text-white',
                          isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3.5"
                        )}
                      >
                        <item.icon className={cn(
                          "transition-transform duration-300 group-hover:scale-110",
                          isCollapsed ? "h-6 w-6  " : "mr-3 h-5 w-5"
                        )} />

                        {!isCollapsed && (
                          <span className="text-sm whitespace-nowrap">
                            {item.name}
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        {content}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return content;
              })}
            </AnimatePresence>
          </TooltipProvider>
        </nav>
      </div>

      {/* SIGN OUT */}
      <div className={cn("px-4 pb-4", isCollapsed && "px-2")}>
        <Button
          variant="ghost"
          onClick={() => signOut()}
          className={cn(
            "w-full text-white/90 hover:text-white hover:bg-white/10 rounded-xl",
            isCollapsed ? "justify-center" : "justify-start gap-3"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>Sign Out</span>}
        </Button>
      </div>

    </div>
  );
}