import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';

import routes from './routes';

import { AuthProvider } from '@/contexts/AuthContext';
import { SiteProvider } from '@/contexts/SiteContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { IPSecurityGuard } from '@/components/common/IPSecurityGuard';
import { ContentProtectionProvider } from '@/components/common/ContentProtectionProvider';
import { IdleTimeoutProvider } from '@/components/common/IdleTimeoutProvider';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Toaster } from '@/components/ui/toaster';
// import { ChatWidget } from '@/components/common/ChatWidget';
import 'react-quill/dist/quill.snow.css';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <IdleTimeoutProvider>
      <IntersectObserver />
      {isLoginPage ? (
        <Routes>
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <IPSecurityGuard>
          <ContentProtectionProvider>
            <AppLayout>
              <Routes>
                {routes.map((route, index) => (
                  <Route
                    key={index}
                    path={route.path}
                    element={route.element}
                  />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ContentProtectionProvider>
          {/* removed chat widget */}
          {/* <ChatWidget /> */}
        </IPSecurityGuard>
      )}
      <Toaster />
    </IdleTimeoutProvider>
  );
}

const App: React.FC = () => {
  return (
    <Router>
      <SiteProvider>
        <AuthProvider>
          <RouteGuard>
            <AppContent />
          </RouteGuard>
        </AuthProvider>
      </SiteProvider>
    </Router>
  );
};

export default App;

