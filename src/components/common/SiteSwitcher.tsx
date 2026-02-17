
// new component i created for site switching functionality, it uses a dropdown menu to list accessible sites and allows users to switch between them. The component is designed to be hidden when the sidebar is collapsed for better UX.
import { Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SiteSwitcherProps {
  accessibleSites: Array<{ id: string | number; name: string }>;
  currentSite: { id: string | number; name: string } | null;
  setCurrentSite: (id: string | number) => void;
  isCollapsed?: boolean;
}

export function SiteSwitcher({
  accessibleSites,
  currentSite,
  setCurrentSite,
  isCollapsed = false,
}: SiteSwitcherProps) {
  if (accessibleSites.length === 0 || isCollapsed) return null;

  return (
    <div className="px-4 py-3 flex-shrink-0 ">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between bg-white/10 hover:bg-white/20 !text-white  border border-white/20 backdrop-blur-sm h-12 rounded-xl transition-all duration-300 group shadow-lg "
          >
            <span className="flex items-center gap-2.5 truncate ">
              <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors group-hover:text-white">
                <Globe className="h-4 w-4 flex-shrink-0" />
              </div>
              <span className="truncate font-medium  text-white group-hover:text-white">
                {currentSite?.name || 'Select Site'}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-70 group-hover:text-white" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[15rem] p-2 bg-white/95 backdrop-blur-xl border-white/20 shadow-xl rounded-xl"
        >
          {accessibleSites.map((site) => (
            <DropdownMenuItem
              key={site.id}
              onClick={() => setCurrentSite(site.id)}
              className={cn(
                'cursor-pointer rounded-lg px-3 py-2.5 my-0.5 font-medium transition-colors',
                currentSite?.id === site.id
                  ? 'bg-[#ff0000] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Globe className="mr-3 h-4 w-4 opacity-70" />
              <span className="truncate">{site.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
