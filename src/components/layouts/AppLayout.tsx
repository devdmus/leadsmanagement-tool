import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSidebar = () => setIsCollapsed((prev) => !prev);

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={
          `hidden md:block shrink-0 transition-all duration-300 fixed left-0 top-0 h-screen z-30 ${isCollapsed ? 'w-[80px]' : 'w-72'}`
        }
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.08)' }}
      >
        <AppSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      </aside>
      <div className="flex-1 flex flex-col md:ml-[80px]" style={{ marginLeft: isCollapsed ? 80 : 288, transition: 'margin-left 0.3s' }}>
        <AppHeader />
        <main className="flex-1 p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
// fixed scroll bar issue by making sidebar fixed and adjusting main content margin accordingly, also added transition for smooth collapsing effect