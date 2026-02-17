import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';

import routes from './routes';

import { AuthProvider } from '@/contexts/AuthContext';
import { SiteProvider } from '@/contexts/SiteContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { IPSecurityGuard } from '@/components/common/IPSecurityGuard';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import { ChatWidget } from '@/components/common/ChatWidget';
import 'react-quill/dist/quill.snow.css';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <>
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
          <ChatWidget />
        </IPSecurityGuard>
      )}
      <Toaster />
    </>
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

